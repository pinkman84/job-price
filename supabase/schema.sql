-- Run this in the Supabase SQL editor for your project.
-- Everything is scoped per-user (auth.uid()) via RLS: each contractor only ever
-- sees their own clients, materials, suppliers, tax codes, jobs and images.

-- ---------------------------------------------------------------------------
-- Addresses
-- ---------------------------------------------------------------------------
create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  line1 text not null,
  line2 text,
  city text,
  country text,
  postcode text,
  created_at timestamptz not null default now()
);

create index if not exists addresses_user_id_idx on addresses (user_id);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  address_id uuid references addresses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on clients (user_id);

-- ---------------------------------------------------------------------------
-- Tax codes (e.g. "VAT20" -> 0.20)
-- ---------------------------------------------------------------------------
create table if not exists tax_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  rate numeric(6, 4) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists suppliers_user_id_idx on suppliers (user_id);

-- ---------------------------------------------------------------------------
-- Materials (reusable catalog) + market prices (per supplier, over time)
-- ---------------------------------------------------------------------------
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  unit text, -- e.g. 'kg', 'm', 'each'
  created_at timestamptz not null default now()
);

create index if not exists materials_user_id_idx on materials (user_id);

create table if not exists material_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  material_id uuid not null references materials (id) on delete cascade,
  supplier_id uuid not null references suppliers (id) on delete cascade,
  cost numeric not null,
  currency_code text not null default 'GBP',
  recorded_at timestamptz not null default now()
);

create index if not exists material_prices_material_id_idx on material_prices (material_id);
create index if not exists material_prices_supplier_id_idx on material_prices (supplier_id);

-- Latest known price per material/supplier pair.
create or replace view material_latest_prices as
select distinct on (material_id, supplier_id)
  material_id,
  supplier_id,
  cost,
  currency_code,
  recorded_at
from material_prices
order by material_id, supplier_id, recorded_at desc;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  client_id uuid references clients (id) on delete set null,
  address_id uuid references addresses (id) on delete set null, -- job site address
  status text not null default 'draft' check (status in ('draft', 'sent', 'awarded', 'lost', 'complete')),
  date_created timestamptz not null default now(),
  date_awarded timestamptz,
  due_date date,
  currency_code text not null default 'GBP',
  subtotal numeric not null default 0,
  tax_code_id uuid references tax_codes (id) on delete set null,
  tax_rate numeric(6, 4) not null default 0, -- snapshot of the rate at quote time
  tax_amount numeric generated always as (round(subtotal * tax_rate, 2)) stored,
  total numeric generated always as (subtotal + round(subtotal * tax_rate, 2)) stored,
  paid_in_full boolean not null default false,
  amount_outstanding numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_user_id_idx on jobs (user_id);
create index if not exists jobs_client_id_idx on jobs (client_id);

-- ---------------------------------------------------------------------------
-- Job line items
-- ---------------------------------------------------------------------------
create table if not exists job_line_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  material_id uuid references materials (id) on delete set null,
  supplier_id uuid references suppliers (id) on delete set null,
  description text not null,
  quantity numeric not null default 1,
  unit_cost numeric not null default 0,
  line_total numeric generated always as (quantity * unit_cost) stored,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists job_line_items_job_id_idx on job_line_items (job_id);

-- ---------------------------------------------------------------------------
-- Job images
-- ---------------------------------------------------------------------------
create table if not exists job_images (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_images_job_id_idx on job_images (job_id);

-- ---------------------------------------------------------------------------
-- Client outstanding balance (derived, not stored, so it can't drift)
-- ---------------------------------------------------------------------------
create or replace view client_outstanding_totals as
select
  client_id,
  sum(amount_outstanding) filter (where not paid_in_full) as outstanding
from jobs
where client_id is not null
group by client_id;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger jobs_set_updated_at
  before update on jobs
  for each row
  execute function set_updated_at();

create trigger clients_set_updated_at
  before update on clients
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table addresses enable row level security;
alter table clients enable row level security;
alter table tax_codes enable row level security;
alter table suppliers enable row level security;
alter table materials enable row level security;
alter table material_prices enable row level security;
alter table jobs enable row level security;
alter table job_line_items enable row level security;
alter table job_images enable row level security;

create policy "Users manage their own addresses"
  on addresses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own clients"
  on clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own tax codes"
  on tax_codes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own suppliers"
  on suppliers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own materials"
  on materials for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own material prices"
  on material_prices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own jobs"
  on jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage line items for their own jobs"
  on job_line_items for all
  using (exists (select 1 from jobs where jobs.id = job_line_items.job_id and jobs.user_id = auth.uid()))
  with check (exists (select 1 from jobs where jobs.id = job_line_items.job_id and jobs.user_id = auth.uid()));

create policy "Users manage images for their own jobs"
  on job_images for all
  using (exists (select 1 from jobs where jobs.id = job_images.job_id and jobs.user_id = auth.uid()))
  with check (exists (select 1 from jobs where jobs.id = job_images.job_id and jobs.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage bucket for job photos (private; access via signed URLs / RLS-scoped policies)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('job-images', 'job-images', false)
on conflict (id) do nothing;

create policy "Users manage their own job images in storage"
  on storage.objects for all
  using (bucket_id = 'job-images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'job-images' and auth.uid()::text = (storage.foldername(name))[1]);
