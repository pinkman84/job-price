# Job Pricer

A tool for contractors to price a job and save it for later reference — accessible from
any device, with cloud data, auth, and room to attach photos.

## Stack

- **React + Vite + TypeScript** — single-page app, client-side routed with `react-router-dom`.
- **Supabase** — Postgres database, auth, and file storage in one backend.
- Deployment target: any static host (Vercel/Netlify/Cloudflare Pages) since it's a pure SPA
  talking directly to Supabase.

## Data model

Normalized relational schema, all tables scoped per-user via RLS:

- **`addresses`** — reusable postal address (used for both a client's billing address and a
  job's site address, which are often different).
- **`clients`** — name + billing `address_id`. A client's running balance isn't stored — it's
  derived from `jobs` via the `client_outstanding_totals` view, so it can't drift out of sync.
- **`tax_codes`** — reusable named rates (e.g. `VAT20` → 0.20) you can apply to a job.
- **`suppliers`** / **`materials`** — a material (e.g. "6mm mild steel plate") is reusable, but
  its price is market-driven and varies by supplier, so pricing lives separately in
  **`material_prices`** (material × supplier × cost × timestamp) with a `material_latest_prices`
  view for the current known price per supplier.
- **`jobs`** — core fields (`name`, `client_id`, `address_id`, `status`, `due_date`,
  `date_awarded`), plus `subtotal`, `tax_rate` (a snapshot, independent of `tax_codes.rate` so
  past quotes don't change if a tax code's rate is edited later), and generated `tax_amount` /
  `total` columns. `paid_in_full` and `amount_outstanding` are tracked directly on the job.
- **`job_line_items`** — a job's priced lines (description, quantity, unit cost, optionally
  linked to a `material_id`/`supplier_id`); `subtotal` on the job is the sum of these.
- **`job_images`** — photos, pointing at files in a private Supabase Storage bucket
  (`job-images`).

See [`supabase/schema.sql`](supabase/schema.sql) for the full schema, generated columns, views,
and row-level security policies.

## Getting started

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema** — open the SQL editor in your Supabase project and run the contents of
   [`supabase/schema.sql`](supabase/schema.sql). This creates all tables/views, RLS policies, and
   the `job-images` storage bucket.
3. **Configure env vars** — copy `.env.example` to `.env` and fill in your project's URL and anon
   key (Project Settings → API in Supabase).
4. **Install and run**:

   ```bash
   npm install
   npm run dev
   ```

5. **Enable email auth** — Supabase projects have email/password auth on by default. For local
   dev, you can turn off "Confirm email" under Authentication → Providers → Email so sign-up
   works immediately.

## Current features

- Email/password auth (sign up, sign in, sign out), gated routes.
- Create, view, edit, and delete jobs with itemized line items, a job site address, tax rate,
  and payment status.
- Typing a client name on the job form finds-or-creates that client, so clients build up as a
  reusable list automatically.
- Job list with status badges and computed totals.

## Roadmap / not yet built

- Image upload UI for the `job-images` bucket (schema and RLS are already in place).
- A materials/suppliers picker on line items, pulling from `material_latest_prices` instead of
  free-text description/cost.
- A dedicated clients page (view a client's job history and running balance from
  `client_outstanding_totals`).
- Saved tax codes in the job form (currently a free-typed rate; `tax_codes` table exists but
  isn't wired into the UI yet).
- PDF/shareable quote export.
- Search/filter/sort on the job list.
- Native iOS/Android wrapper — deferred. The SPA is the priority; if a native app is warranted
  later, wrapping this same Supabase backend (e.g. via Capacitor, or a React Native rewrite
  sharing the data layer) is the planned path rather than building native from scratch.

## Project structure

```
src/
  lib/supabase.ts          Supabase client
  context/AuthContext.tsx  Session state
  components/              Shared components (route guard)
  pages/                   Login, JobsList, JobForm, JobDetail
  types.ts                 Job/Client/Address/Material/Supplier/TaxCode/JobLineItem types
supabase/schema.sql        DB schema + views + RLS + storage bucket, run manually in Supabase
```
