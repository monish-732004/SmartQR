-- Admin module enhancement: librarians report socket issues and student
-- misconduct; every report goes to the super admin for investigation and
-- decision. No librarian, and no automatic rule, can ever restrict a
-- student directly — a student_restrictions row can only be created by
-- review_incident_report() below, and only an admin can call it.

create type incident_report_type as enum ('socket_issue', 'student_conduct');
create type conduct_category as enum (
  'playing_games', 'excessive_talking', 'disturbing_others',
  'inappropriate_behavior', 'other'
);
create type incident_report_status as enum ('pending', 'approved', 'rejected', 'resolved');
create type restriction_type as enum ('warning', 'temporary', 'permanent');
create type restriction_scope as enum ('sockets', 'all_services');

create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  report_type incident_report_type not null,
  reporter_id uuid not null references profiles (id) on delete restrict,
  student_id uuid references profiles (id) on delete restrict,
  point_id uuid references charging_points (id) on delete set null,
  conduct_category conduct_category,
  description text not null,
  occurred_at timestamptz not null default now(),
  evidence_path text,
  status incident_report_status not null default 'pending',
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  constraint incident_reports_conduct_needs_student
    check (report_type <> 'student_conduct' or student_id is not null),
  constraint incident_reports_socket_issue_needs_point
    check (report_type <> 'socket_issue' or point_id is not null)
);

create index idx_incident_reports_status on incident_reports (status);
create index idx_incident_reports_student on incident_reports (student_id);
create index idx_incident_reports_point on incident_reports (point_id);

create table student_restrictions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  incident_report_id uuid not null references incident_reports (id) on delete restrict,
  restriction_type restriction_type not null,
  scope restriction_scope not null default 'all_services',
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  issued_by uuid not null references profiles (id),
  revoked_at timestamptz,
  revoked_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_student_restrictions_student on student_restrictions (student_id);

alter table incident_reports enable row level security;
alter table student_restrictions enable row level security;

-- incident_reports: reporter sees their own; admin sees everything.
-- Deliberately tighter than fault_reports — these name specific students,
-- not shared floor equipment, so other librarians don't see them.
create policy incident_reports_select on incident_reports for select
  using (reporter_id = auth.uid() or is_admin());
create policy incident_reports_insert_own on incident_reports for insert
  with check (is_staff() and reporter_id = auth.uid());
-- No update policy: status changes only via review_incident_report() (security definer).

-- student_restrictions: the restricted student can see their own record;
-- admin sees everything. No direct insert/update — only via RPC.
create policy student_restrictions_select on student_restrictions for select
  using (student_id = auth.uid() or is_admin());

-- Whether a student is currently blocked from p_required_scope.
-- 'warning' restrictions never block anything — they're a record, not an
-- enforcement action. A scope='all_services' restriction blocks everything.
create or replace function is_restricted(p_student uuid, p_required_scope restriction_scope)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_restrictions
    where student_id = p_student
      and restriction_type in ('temporary', 'permanent')
      and revoked_at is null
      and (ends_at is null or ends_at > now())
      and (scope = 'all_services' or scope = p_required_scope)
  );
$$;

create or replace function report_socket_issue(
  p_point_id uuid,
  p_description text,
  p_evidence_path text default null
)
returns incident_reports
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_actor_role user_role;
  v_report incident_reports;
begin
  if not is_staff() then
    raise exception 'staff only';
  end if;

  insert into incident_reports (report_type, reporter_id, point_id, description, evidence_path)
  values ('socket_issue', v_user, p_point_id, p_description, p_evidence_path)
  returning * into v_report;

  select role into v_actor_role from profiles where id = v_user;
  insert into audit_log (actor_id, actor_role, action, point_id, details)
  values (v_user, v_actor_role, 'report_socket_issue', p_point_id,
    jsonb_build_object('report_id', v_report.id));

  return v_report;
end;
$$;

create or replace function report_student_conduct(
  p_student_id uuid,
  p_point_id uuid,
  p_conduct_category conduct_category,
  p_description text,
  p_occurred_at timestamptz default now(),
  p_evidence_path text default null
)
returns incident_reports
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_actor_role user_role;
  v_report incident_reports;
begin
  if not is_staff() then
    raise exception 'staff only';
  end if;

  insert into incident_reports (
    report_type, reporter_id, student_id, point_id, conduct_category,
    description, occurred_at, evidence_path
  )
  values (
    'student_conduct', v_user, p_student_id, p_point_id, p_conduct_category,
    p_description, p_occurred_at, p_evidence_path
  )
  returning * into v_report;

  select role into v_actor_role from profiles where id = v_user;
  insert into audit_log (actor_id, actor_role, action, point_id, target_user_id, details)
  values (v_user, v_actor_role, 'report_student_conduct', p_point_id, p_student_id,
    jsonb_build_object('report_id', v_report.id, 'category', p_conduct_category));

  return v_report;
end;
$$;

-- The single admin decision point. Approving a student_conduct report
-- atomically records the restriction in the same transaction — a report
-- can never be approved without a restriction being decided, and a
-- restriction can never exist without an approved report behind it.
create or replace function review_incident_report(
  p_report_id uuid,
  p_decision incident_report_status,
  p_review_notes text default null,
  p_restriction_type restriction_type default null,
  p_restriction_scope restriction_scope default 'all_services',
  p_restriction_days int default null
)
returns incident_reports
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_report incident_reports;
  v_ends_at timestamptz;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  if p_decision = 'pending' then
    raise exception 'decision must be approved, rejected, or resolved';
  end if;

  select * into v_report from incident_reports where id = p_report_id for update;
  if not found then
    raise exception 'incident report not found';
  end if;
  if v_report.status <> 'pending' then
    raise exception 'this report has already been reviewed';
  end if;

  if p_decision = 'approved' then
    if v_report.report_type <> 'student_conduct' then
      raise exception 'only student conduct reports can be approved with a restriction';
    end if;
    if p_restriction_type is null then
      raise exception 'a restriction type is required to approve a conduct report';
    end if;
    if p_restriction_type = 'temporary' and p_restriction_days is null then
      raise exception 'a duration in days is required for a temporary restriction';
    end if;

    v_ends_at := case when p_restriction_type = 'temporary'
      then now() + (p_restriction_days || ' days')::interval
      else null
    end;

    insert into student_restrictions (
      student_id, incident_report_id, restriction_type, scope, reason, ends_at, issued_by
    )
    values (
      v_report.student_id, v_report.id, p_restriction_type, p_restriction_scope,
      p_review_notes, v_ends_at, v_user
    );
  end if;

  update incident_reports
    set status = p_decision, reviewed_by = v_user, reviewed_at = now(), review_notes = p_review_notes
    where id = p_report_id
    returning * into v_report;

  insert into audit_log (actor_id, actor_role, action, point_id, target_user_id, details)
  values (v_user, 'admin', 'review_incident_report', v_report.point_id, v_report.student_id,
    jsonb_build_object(
      'report_id', v_report.id, 'decision', p_decision,
      'restriction_type', p_restriction_type, 'restriction_scope', p_restriction_scope
    ));

  return v_report;
end;
$$;

create or replace function revoke_restriction(p_restriction_id uuid, p_notes text default null)
returns student_restrictions
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_restriction student_restrictions;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;

  update student_restrictions
    set revoked_at = now(), revoked_by = v_user
    where id = p_restriction_id and revoked_at is null
    returning * into v_restriction;

  if not found then
    raise exception 'restriction not found or already revoked';
  end if;

  insert into audit_log (actor_id, actor_role, action, target_user_id, details)
  values (v_user, 'admin', 'revoke_restriction', v_restriction.student_id,
    jsonb_build_object('restriction_id', v_restriction.id, 'notes', p_notes));

  return v_restriction;
end;
$$;

revoke execute on function
  report_socket_issue, report_student_conduct, review_incident_report,
  revoke_restriction, is_restricted
from public;

grant execute on function report_socket_issue, report_student_conduct to authenticated;
grant execute on function review_incident_report, revoke_restriction to authenticated;
grant execute on function is_restricted to authenticated;

-- Enforcement: re-declare with the exact same bodies as 0005, plus one
-- is_restricted() check each. A sockets-only restriction blocks starting
-- a session; only a full all_services ban also blocks filing fault
-- reports (a sockets-only restriction shouldn't stop someone reporting a
-- genuinely broken socket elsewhere).

create or replace function start_charging_session(
  p_point_id uuid,
  p_purpose session_purpose default 'charging_only'
)
returns sessions
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_actor_role user_role;
  v_health health_status;
  v_session sessions;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if is_restricted(v_user, 'sockets') then
    raise exception 'you are restricted from using library sockets';
  end if;

  select health_status into v_health
  from charging_points where id = p_point_id for update;

  if not found then
    raise exception 'charging point not found';
  end if;
  if v_health = 'maintenance' then
    raise exception 'this point is under maintenance';
  end if;

  insert into sessions (point_id, user_id, purpose)
  values (p_point_id, v_user, p_purpose)
  returning * into v_session;

  update charging_points set availability_status = 'occupied' where id = p_point_id;

  select role into v_actor_role from profiles where id = v_user;
  insert into audit_log (actor_id, actor_role, action, point_id, details)
  values (v_user, v_actor_role, 'start_session', p_point_id,
    jsonb_build_object('session_id', v_session.id, 'purpose', p_purpose));

  return v_session;
end;
$$;

create or replace function file_fault_report(
  p_point_id uuid,
  p_issue_type fault_issue_type,
  p_description text default null
)
returns fault_reports
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_actor_role user_role;
  v_report fault_reports;
  v_corroboration int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if is_restricted(v_user, 'all_services') then
    raise exception 'you are restricted from using library services';
  end if;

  insert into fault_reports (point_id, reporter_id, issue_type, description)
  values (p_point_id, v_user, p_issue_type, p_description)
  returning * into v_report;

  select count(distinct reporter_id) into v_corroboration
  from fault_reports
  where point_id = p_point_id
    and status = 'pending'
    and created_at > now() - interval '48 hours';

  if v_corroboration >= 2 then
    update charging_points
      set health_status = 'reported_issue'
      where id = p_point_id and health_status = 'working';
  end if;

  select role into v_actor_role from profiles where id = v_user;
  insert into audit_log (actor_id, actor_role, action, point_id, details)
  values (v_user, v_actor_role, 'file_fault_report', p_point_id,
    jsonb_build_object(
      'report_id', v_report.id, 'issue_type', p_issue_type,
      'corroboration_count', v_corroboration
    ));

  return v_report;
end;
$$;

-- Private evidence bucket. Staff can upload and read; nobody else. Admin
-- reads via a signed URL generated server-side during review, since the
-- bucket is not public.
insert into storage.buckets (id, name, public)
values ('incident-evidence', 'incident-evidence', false)
on conflict (id) do nothing;

create policy incident_evidence_staff_insert on storage.objects for insert
  with check (bucket_id = 'incident-evidence' and is_staff());
create policy incident_evidence_staff_select on storage.objects for select
  using (bucket_id = 'incident-evidence' and is_staff());
