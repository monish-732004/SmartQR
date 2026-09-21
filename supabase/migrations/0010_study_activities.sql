-- Personal study/work tracker for students: independent of charging
-- sessions (studying doesn't require a socket), so a student can start
-- and stop a "DSA" or "System Design" block any time and see analytics
-- on their dashboard for where their time actually goes. Same
-- concurrency shape as `sessions`: one active (unended) row per user,
-- enforced by a partial unique index, mutated only through the two
-- SECURITY DEFINER functions below.

create type study_category as enum (
  'dsa', 'system_design', 'aptitude', 'interview_prep', 'reading', 'other'
);

create table study_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  category study_category not null,
  label text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_study_activities_user on study_activities (user_id);
create index idx_study_activities_started_at on study_activities (started_at);

-- Mirrors uniq_active_session_per_user (0001_init.sql): only one running
-- activity per student at a time.
create unique index uniq_active_study_activity_per_user
  on study_activities (user_id) where ended_at is null;

alter table study_activities enable row level security;

-- A student reads only their own history. No insert/update policy: both
-- writes only ever happen through the security-definer functions below,
-- which bypass RLS by running as the table owner — same reasoning as
-- fault_reports/sessions writes elsewhere in this app.
create policy study_activities_select_own on study_activities for select
  using (user_id = auth.uid());

create or replace function start_study_activity(
  p_category study_category,
  p_label text default null
)
returns study_activities
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_activity study_activities;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  update study_activities
    set ended_at = now()
    where user_id = v_user and ended_at is null;

  insert into study_activities (user_id, category, label)
  values (v_user, p_category, p_label)
  returning * into v_activity;

  return v_activity;
end;
$$;

create or replace function stop_study_activity()
returns study_activities
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_activity study_activities;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  update study_activities
    set ended_at = now()
    where user_id = v_user and ended_at is null
    returning * into v_activity;

  if not found then
    raise exception 'no active study activity';
  end if;

  return v_activity;
end;
$$;

revoke execute on function start_study_activity, stop_study_activity from public;
grant execute on function start_study_activity, stop_study_activity to authenticated;
