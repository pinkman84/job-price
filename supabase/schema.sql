-- Run this in the Supabase SQL editor for your project.

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  location text not null default '',
  client text not null default '',
  price numeric not null default 0,
  status text not null default 'draft' check (status in ('draft', 'quoted', 'won', 'lost')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_user_id_idx on jobs (user_id);

create table if not exists job_images (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_images_job_id_idx on job_images (job_id);

alter table jobs enable row level security;
alter table job_images enable row level security;

create policy "Users manage their own jobs"
  on jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage images for their own jobs"
  on job_images for all
  using (exists (select 1 from jobs where jobs.id = job_images.job_id and jobs.user_id = auth.uid()))
  with check (exists (select 1 from jobs where jobs.id = job_images.job_id and jobs.user_id = auth.uid()));

-- Keep updated_at current on edits.
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

-- Storage bucket for job photos (private; access via signed URLs / RLS-scoped policies).
insert into storage.buckets (id, name, public)
values ('job-images', 'job-images', false)
on conflict (id) do nothing;

create policy "Users manage their own job images in storage"
  on storage.objects for all
  using (bucket_id = 'job-images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'job-images' and auth.uid()::text = (storage.foldername(name))[1]);
