# SmartPlug QR

MVP for library charging-point discovery, health tracking, and management.
Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, RLS).

## What's implemented

**Students**
- Browse charging points by floor, grouped by physical station, with live availability + health
  status — updates automatically for everyone as sessions start/end and reports come in, no
  refresh needed (Supabase Realtime)
- Scan a station's signed QR to open its page — one QR covers every port at that station, since
  a real charging station has multiple sockets under a single printed code
- Pick a port, then Start / End Session ("Mark Occupied" / "Mark Available"), with a purpose tag
  (Charging Only / Study / Project Work / Exam Prep)
- Report a fault on a specific port (no power, loose socket, intermittent charging, physical
  damage, overheating, other)
- Personal dashboard: total hours, session count, avg duration, active days, most-used point,
  26-week activity heatmap, streak

**Librarians** (`/admin`) — the day-to-day work, scoped to one floor
- Each librarian is assigned exactly one floor (Ground / First / Second) and only sees/manages
  that floor's points, fault reports, and maintenance tickets — enforced by RLS and by the
  floor-check inside every staff RPC function, not just hidden in the UI
- Live counts of Available / Occupied / Reserved and Working / Reported issue / Maintenance for
  their floor, updating in real time as students act
- Floor drill-down with manual status correction — a librarian can mark a port
  occupied/available/under-maintenance directly, no scan required
- Fault report inbox (their floor only) with corroboration count, verify → opens a maintenance
  ticket, or dismiss
- Maintenance ticket close-out (a point can't go back to Working with an open ticket — enforced
  in the database, not just the UI)
- Analytics scoped to their floor: peak-hour demand, usage ranking, underutilized-point flags,
  repeat-breakdown flags, maintenance history
- QR code management page (`/admin/qr-codes`), their floor's stations only

**Admins** (super admin — unrestricted, everything above across every floor, plus)
- `/admin/users` — assign who is a librarian (with a required floor) or admin; a librarian can't
  promote anyone, including themselves, and can't grant themselves another floor
- `/admin/activity` — an audit trail of what students and librarians/admins have actually done
  (sessions started/ended, reports filed, statuses corrected, tickets closed, roles changed),
  split by who did it — this is how an admin confirms students are actually scanning rather
  than librarians quietly doing everything manually, across every floor at once

**Login**
- Everyone starts with email magic-link login (institutional domain allowlist)
- Librarians/admins can additionally set a password (`/account/set-password`, or the 🔑 in the
  nav) and, from then on, sign in with email + password as a faster alternative — the email link
  still always works too
- A staff account can also sign in with a **registration ID** instead of email (resolved to the
  account's email server-side, then the normal password check runs) — this is how accounts an
  admin provisions directly (no real inbox involved) sign in day to day. Three per-floor
  librarian accounts are pre-provisioned this way — see Setup below

**System**
- Every station's QR encodes an HMAC-signed URL over its shared `qr_code` (`src/lib/qr.ts`) —
  the scan page rejects any code/signature pair it didn't sign itself
- Multiple ports share one QR: `charging_points.qr_code` groups the sockets at one physical
  station (`supabase/migrations/0003_qr_groups_and_realtime.sql`); each port still has its own
  status, sessions, and fault history under its own unique `code`
- Status changes propagate live via Supabase Realtime (`src/lib/useRealtimeChargingPoints.ts`) —
  a student marking a port occupied/available, or a librarian correcting a status, updates every
  open floor view and the admin dashboard without a refresh
- Session start/end, fault reporting, and staff actions run as atomic Postgres functions
  (`supabase/migrations/0002_functions.sql`), not multi-step client code
- "First scan wins" concurrency is a database constraint: partial unique indexes on
  `sessions(point_id)`/`sessions(user_id)` where `ended_at is null` reject a second concurrent
  INSERT before either transaction commits — see `supabase/migrations/0001_init.sql`
- A fault report alone doesn't flip a point's health; it takes a second, distinct reporter
  within 48h before the system auto-flags it (librarians can still act on a single report)
- Institutional-email-only login via Supabase magic link, domain allowlist in `.env.local`
- Librarians/admins can set a password after their first magic-link login (`/account/set-password`)
  and sign in with it afterwards instead of an email round trip every time; students stay
  email-link-only. Setting a password can't be used to self-promote — see the note in
  `0007_staff_password_login.sql` about the column-level privilege fix that closes that off
- Row-level security on every table; librarian/admin actions additionally go through
  `SECURITY DEFINER` functions that check the caller's role themselves
- Three-tier roles (student / librarian / admin) with an audit log every state-changing
  function writes to (`supabase/migrations/0005_audit_and_roles.sql`) — readable by admins only

**Not built yet** (left for the roadmap, per the product spec): advance reservations, real-time
floor recommendations, interactive floor maps, automated long-session reminders, offline
event queuing, hardware sensor integration, ML demand prediction.

## Setup

Prerequisites: Node 20+, Docker Desktop (for local Supabase).

```bash
npm install

# Start local Supabase (Postgres + Auth + Studio) — Docker must be running
npm run db:start
# prints your local anon key / service role key / Studio URL; copy the
# anon key + service role key into .env.local (already scaffolded from
# .env.local.example)

# Apply the schema + seed data
npm run db:reset

# Generate signed QR PNGs for the seeded points (public/qr/*.png)
npm run qr:generate

npm run dev
```

Open http://localhost:3000. Sign in with an email on the domain(s) listed in
`NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` — Supabase's local dev setup captures outgoing
emails at http://127.0.0.1:54324 (Inbucket), so you don't need a real mail server
to grab the magic link.

New users default to the `student` role. To make yourself a super admin for testing
(admins are unrestricted, so no floor assignment needed):

```sql
-- in Supabase Studio's SQL editor (http://127.0.0.1:54323), after you've signed in once
update profiles set role = 'admin' where email = 'you@college.edu';
```

Then visit `/admin`. From there, `/admin/users` lets you promote anyone else to librarian
(picking their floor) or admin — no more raw SQL needed after this first one. A librarian
created via raw SQL instead of `/admin/users` needs `floor_id` set too, or the floor-scoped
RLS policies will show them nothing:

```sql
update profiles set role = 'librarian', floor_id = (select id from floors where name = 'Ground Floor')
  where email = 'someone@college.edu';
```

### Provisioning the three floor librarians

Run once, after `0008_floor_scoped_librarians.sql` (below) is applied and `.env.local` has
`SUPABASE_SERVICE_ROLE_KEY` set:

```bash
npm run create:librarians
```

This creates one account per floor (Ground/First/Second), each with a generated registration ID
(`LIB-GROUND` etc.) and password printed once to the terminal — no email involved, since these
accounts are provisioned directly rather than signing up. Sign in at `/login` → **Password** tab
using the registration ID in place of an email.

### Using a hosted Supabase project instead

Skip `db:start`/`db:reset`; instead create a project at supabase.com, run the SQL in
`supabase/migrations/0001_init.sql`, then `0002_functions.sql`, then
`0003_qr_groups_and_realtime.sql`, then `0004_bulk_demo_seed.sql`, then
`0005_audit_and_roles.sql`, then `0006_floor_layout.sql` (this one is the current seed — skip
`supabase/seed.sql` if you ran any earlier one), then `0007_staff_password_login.sql`, then
`0008_floor_scoped_librarians.sql`, in its SQL editor, and point `.env.local` at that project's
URL/keys.

## Project structure

```
supabase/migrations/   schema, RLS policies, atomic RPC functions, QR grouping + realtime
supabase/seed.sql      sample floors + charging points (grouped into stations)
scripts/                QR PNG generation (one per station)
src/lib/                Supabase clients, auth helpers, QR signing, realtime hook, domain types
src/app/floors/         student: browse by floor, grouped by station, live
src/app/s/[code]/       student: station scan page (pick a port, start/end, report fault)
src/app/dashboard/      student: personal stats
src/app/admin/          librarian/admin: overview, floor correction, reports, analytics, QR codes
```
