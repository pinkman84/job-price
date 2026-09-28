# Job Pricer

A tool for contractors to price a job and save it for later reference — accessible from
any device, with cloud data, auth, and room to attach photos.

## Stack

- **React + Vite + TypeScript** — single-page app, client-side routed with `react-router-dom`.
- **Supabase** — Postgres database, auth, and file storage in one backend.
- Deployment target: any static host (Vercel/Netlify/Cloudflare Pages) since it's a pure SPA
  talking directly to Supabase.

## Data model

A `job` has required core fields — `name`, `location`, `client`, `price` — plus a `status`
(`draft` / `quoted` / `won` / `lost`) and a `details` JSONB column for everything optional and
still evolving (currently just `notes`; line items, materials, labour breakdowns etc. can be
added here without a migration each time). Photos live in a separate `job_images` table pointing
at files in a private Supabase Storage bucket (`job-images`), scoped per-user via RLS. See
[`supabase/schema.sql`](supabase/schema.sql) for the full schema and row-level security policies.

## Getting started

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema** — open the SQL editor in your Supabase project and run the contents of
   [`supabase/schema.sql`](supabase/schema.sql). This creates the `jobs` / `job_images` tables,
   RLS policies, and the `job-images` storage bucket.
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
- Create, view, edit, and delete jobs.
- Job list with status badges and price.

## Roadmap / not yet built

- Image upload UI for the `job-images` bucket (schema and RLS are already in place).
- Line items / itemized pricing breakdown (using the `details.lineItems` field already in the type).
- PDF/shareable quote export.
- Search/filter/sort on the job list.
- Native iOS/Android wrapper — deferred. The SPA is the priority; if a native app is warranted
  later, wrapping this same Supabase backend (e.g. via Capacitor, or a React Native rewrite
  sharing the data layer) is the planned path rather than building native from scratch.

## Project structure

```
src/
  lib/supabase.ts       Supabase client
  context/AuthContext.tsx  Session state
  components/           Shared components (route guard)
  pages/                 Login, JobsList, JobForm, JobDetail
  types.ts               Job/JobImage/JobDetails types
supabase/schema.sql      DB schema + RLS + storage bucket, run manually in Supabase
```
