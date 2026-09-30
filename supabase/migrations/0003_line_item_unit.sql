-- Run this in the Supabase SQL editor against your existing database.
-- Adds a fixed unit (m / m2 / kg / tonnes / item) to job line items, mainly
-- for materials.

alter table job_line_items add column if not exists unit text;
alter table job_line_items add constraint job_line_items_unit_check
  check (unit is null or unit in ('m', 'm2', 'kg', 'tonnes', 'item'));
