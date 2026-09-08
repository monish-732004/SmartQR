-- SmartPlug QR — core schema
-- Enums --------------------------------------------------------------------

create type user_role as enum ('student', 'librarian', 'admin');
create type availability_status as enum ('available', 'occupied', 'reserved');
create type health_status as enum ('working', 'reported_issue', 'maintenance');
create type session_purpose as enum ('charging_only', 'study', 'project_work', 'exam_prep');
create type fault_issue_type as enum (
  'no_power', 'loose_socket', 'intermittent_charging',
  'physical_damage', 'overheating', 'other'
);
create type fault_report_status as enum ('pending', 'verified', 'dismissed');
create type ticket_status as enum ('open', 'closed');

-- Tables ---------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table floors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table charging_points (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- e.g. F2-P07
  floor_id uuid not null references floors (id) on delete restrict,
  label text,
  availability_status availability_status not null default 'available',
  health_status health_status not null default 'working',
  created_at timestamptz not null default now()
);

create index idx_charging_points_floor on charging_points (floor_id);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references charging_points (id) on delete restrict,
  user_id uuid not null references profiles (id) on delete restrict,
  purpose session_purpose not null default 'charging_only',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '4 hours'),
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_sessions_user on sessions (user_id);
create index idx_sessions_point on sessions (point_id);
create index idx_sessions_started_at on sessions (started_at);

-- Only one active (unended) session per point, and per user, at a time.
-- This is what gives us the "first scan wins" guarantee under concurrency:
-- a second concurrent INSERT for the same point/user hits this unique index
-- and is rejected by Postgres before either transaction commits.
create unique index uniq_active_session_per_point on sessions (point_id) where ended_at is null;
create unique index uniq_active_session_per_user on sessions (user_id) where ended_at is null;

create table fault_reports (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references charging_points (id) on delete cascade,
  reporter_id uuid not null references profiles (id) on delete restrict,
  issue_type fault_issue_type not null,
  description text,
  status fault_report_status not null default 'pending',
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_fault_reports_point on fault_reports (point_id);
create index idx_fault_reports_status on fault_reports (status);

create table maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references charging_points (id) on delete cascade,
  fault_report_id uuid references fault_reports (id),
  opened_by uuid not null references profiles (id),
  owner text,
  deadline timestamptz,
  status ticket_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references profiles (id),
  resolution_notes text
);

create index idx_maintenance_tickets_point on maintenance_tickets (point_id);
create index idx_maintenance_tickets_status on maintenance_tickets (status);

-- Invariant: a point cannot go back to "working" while it still has an
-- open maintenance ticket. Enforced in the DB, not just the API, so it
-- holds no matter which code path performs the update.
create or replace function enforce_ticket_before_working()
returns trigger as $$
begin
  if new.health_status = 'working' and old.health_status <> 'working' then
    if exists (
      select 1 from maintenance_tickets
      where point_id = new.id and status = 'open'
    ) then
      raise exception 'charging point % has an open maintenance ticket; close it before marking Working', new.code;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_enforce_ticket_before_working
  before update on charging_points
  for each row
  execute function enforce_ticket_before_working();

-- Keep updated_at-style bookkeeping simple: profiles are created via trigger
-- on auth.users so every login gets a profile row automatically.
create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row
  execute function handle_new_auth_user();

-- Row Level Security -----------------------------------------------------

alter table profiles enable row level security;
alter table floors enable row level security;
alter table charging_points enable row level security;
alter table sessions enable row level security;
alter table fault_reports enable row level security;
alter table maintenance_tickets enable row level security;

create or replace function is_staff()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('librarian', 'admin')
  );
$$ language sql stable security definer set search_path = public;

-- profiles: everyone can read their own row; staff can read all.
create policy profiles_select_own on profiles for select
  using (id = auth.uid() or is_staff());
create policy profiles_update_own on profiles for update
  using (id = auth.uid());

-- floors: readable by any authenticated user.
create policy floors_select_all on floors for select
  using (auth.role() = 'authenticated');
create policy floors_write_staff on floors for all
  using (is_staff()) with check (is_staff());

-- charging_points: readable by any authenticated user; only staff (or the
-- service role used by API routes) can write.
create policy charging_points_select_all on charging_points for select
  using (auth.role() = 'authenticated');
create policy charging_points_write_staff on charging_points for update
  using (is_staff()) with check (is_staff());

-- sessions: a student sees/creates only their own; staff see everything.
create policy sessions_select_own on sessions for select
  using (user_id = auth.uid() or is_staff());
create policy sessions_insert_own on sessions for insert
  with check (user_id = auth.uid());
create policy sessions_update_own on sessions for update
  using (user_id = auth.uid() or is_staff());

-- fault_reports: a student sees/creates only their own; staff see everything.
create policy fault_reports_select on fault_reports for select
  using (reporter_id = auth.uid() or is_staff());
create policy fault_reports_insert_own on fault_reports for insert
  with check (reporter_id = auth.uid());
create policy fault_reports_update_staff on fault_reports for update
  using (is_staff());

-- maintenance_tickets: staff only.
create policy maintenance_tickets_staff on maintenance_tickets for all
  using (is_staff()) with check (is_staff());
