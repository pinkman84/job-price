-- Run this in the Supabase SQL editor against your existing database. It brings
-- an existing job-pricer database in line with supabase/schema.sql after the
-- labour rates / profit margin / fixed UK tax rate changes.

-- ---------------------------------------------------------------------------
-- Labour rates (separate from materials): reusable hourly/day rates per role.
-- ---------------------------------------------------------------------------
create table if not exists labour_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_name text not null,
  rate_type text not null default 'hourly' check (rate_type in ('hourly', 'daily')),
  rate numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists labour_rates_user_id_idx on labour_rates (user_id);

alter table labour_rates enable row level security;

create policy "Users manage their own labour rates"
  on labour_rates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Profiles: per-user settings (default profit margin, home base address).
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  default_margin_percent numeric not null default 0,
  home_address_id uuid references addresses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users manage their own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger profiles_set_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Job line items: split into material / labour / other, add margin, and
-- recompute line_total to bill at cost + margin instead of raw cost.
-- ---------------------------------------------------------------------------
alter table job_line_items add column if not exists kind text not null default 'material' check (kind in ('material', 'labour', 'other'));
alter table job_line_items add column if not exists labour_rate_id uuid references labour_rates (id) on delete set null;
alter table job_line_items add column if not exists margin_percent numeric not null default 0;

alter table job_line_items drop column if exists line_total;
alter table job_line_items add column line_total numeric generated always as (round(quantity * unit_cost * (1 + margin_percent / 100.0), 2)) stored;

-- ---------------------------------------------------------------------------
-- Jobs: tax rate becomes a fixed UK rate (null / 0% / 5% / 20%) chosen from a
-- dropdown instead of freely typed, so drop the unused tax_codes table/FK and
-- make the generated totals null-safe.
-- ---------------------------------------------------------------------------
alter table jobs drop column if exists tax_amount;
alter table jobs drop column if exists total;
alter table jobs drop constraint if exists jobs_tax_code_id_fkey;
alter table jobs drop column if exists tax_code_id;
alter table jobs alter column tax_rate drop not null;
alter table jobs alter column tax_rate drop default;
alter table jobs add constraint jobs_tax_rate_check check (tax_rate is null or tax_rate in (0, 0.05, 0.20));
alter table jobs add column tax_amount numeric generated always as (round(subtotal * coalesce(tax_rate, 0), 2)) stored;
alter table jobs add column total numeric generated always as (subtotal + round(subtotal * coalesce(tax_rate, 0), 2)) stored;

drop table if exists tax_codes cascade;
