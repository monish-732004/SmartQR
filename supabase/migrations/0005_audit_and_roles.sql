-- Splits "staff" into two tiers that were already distinct in the
-- `user_role` enum but treated identically until now:
--   - librarian: does the day-to-day work — corrects a port's status
--     (with or without a student having scanned it), reviews fault
--     reports, closes maintenance tickets.
--   - admin (super admin): everything a librarian can do, plus assigning
--     who is a librarian, and an audit trail of what students and
--     librarians have actually been doing.
--
-- Every state-changing function now writes one row to audit_log. Only
-- admins can read it — it's oversight, not another activity feed.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id),
  actor_role user_role,
  action text not null,
  point_id uuid references charging_points (id) on delete set null,
  target_user_id uuid references profiles (id) on delete set null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_created_at on audit_log (created_at desc);
create index idx_audit_log_actor on audit_log (actor_id);
create index idx_audit_log_point on audit_log (point_id);

alter table audit_log enable row level security;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

create policy audit_log_select_admin on audit_log for select
  using (is_admin());

-- Assigning roles is admin-only — a librarian can't promote themselves or
-- anyone else. Refuses to let an admin demote themselves out of the role,
-- so there's always at least one admin standing.
create or replace function set_user_role(p_user_id uuid, p_role user_role)
returns profiles
security definer set search_path = public
language plpgsql as $$
declare
  v_profile profiles;
  v_old_role user_role;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'you cannot change your own role away from admin';
  end if;

  select role into v_old_role from profiles where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;

  update profiles set role = p_role where id = p_user_id returning * into v_profile;

  insert into audit_log (actor_id, actor_role, action, target_user_id, details)
  values (auth.uid(), 'admin', 'set_user_role', p_user_id,
    jsonb_build_object('from', v_old_role, 'to', p_role));

  return v_profile;
end;
$$;

-- Re-declare the existing functions (same signatures) to add an
-- audit_log write to each. Behavior is otherwise unchanged.

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

create or replace function end_charging_session(p_point_id uuid)
returns sessions
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_actor_role user_role;
  v_session sessions;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  update sessions
    set ended_at = now()
    where point_id = p_point_id and user_id = v_user and ended_at is null
    returning * into v_session;

  if not found then
    raise exception 'no active session for you on this point';
  end if;

  update charging_points set availability_status = 'available' where id = p_point_id;

  select role into v_actor_role from profiles where id = v_user;
  insert into audit_log (actor_id, actor_role, action, point_id, details)
  values (v_user, v_actor_role, 'end_session', p_point_id,
    jsonb_build_object(
      'session_id', v_session.id,
      'duration_minutes', round(extract(epoch from (v_session.ended_at - v_session.started_at)) / 60)
    ));

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

create or replace function correct_point_status(
  p_point_id uuid,
  p_availability availability_status default null,
  p_health health_status default null
)
returns charging_points
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_actor_role user_role;
  v_before charging_points;
  v_point charging_points;
begin
  if not is_staff() then
    raise exception 'staff only';
  end if;

  select * into v_before from charging_points where id = p_point_id;
  if not found then
    raise exception 'charging point not found';
  end if;

  update charging_points
    set availability_status = coalesce(p_availability, availability_status),
        health_status = coalesce(p_health, health_status)
    where id = p_point_id
    returning * into v_point;

  select role into v_actor_role from profiles where id = v_user;
  insert into audit_log (actor_id, actor_role, action, point_id, details)
  values (v_user, v_actor_role, 'correct_point_status', p_point_id,
    jsonb_build_object(
      'availability_before', v_before.availability_status, 'availability_after', v_point.availability_status,
      'health_before', v_before.health_status, 'health_after', v_point.health_status
    ));

  return v_point;
end;
$$;

create or replace function verify_fault_report(
  p_report_id uuid,
  p_owner text default null,
  p_deadline timestamptz default (now() + interval '3 days')
)
returns maintenance_tickets
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_actor_role user_role;
  v_point_id uuid;
  v_ticket maintenance_tickets;
begin
  if not is_staff() then
    raise exception 'staff only';
  end if;

  update fault_reports
    set status = 'verified', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_report_id
    returning point_id into v_point_id;

  if not found then
    raise exception 'fault report not found';
  end if;

  update charging_points set health_status = 'maintenance' where id = v_point_id;

  insert into maintenance_tickets (point_id, fault_report_id, opened_by, owner, deadline)
  values (v_point_id, p_report_id, auth.uid(), p_owner, p_deadline)
  returning * into v_ticket;

  update fault_reports
    set status = 'verified', reviewed_by = auth.uid(), reviewed_at = now()
    where point_id = v_point_id and status = 'pending' and id <> p_report_id;

  select role into v_actor_role from profiles where id = v_user;
  insert into audit_log (actor_id, actor_role, action, point_id, details)
  values (v_user, v_actor_role, 'verify_fault_report', v_point_id,
    jsonb_build_object('report_id', p_report_id, 'ticket_id', v_ticket.id, 'owner', p_owner));

  return v_ticket;
end;
$$;

create or replace function dismiss_fault_report(p_report_id uuid)
returns fault_reports
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_actor_role user_role;
  v_report fault_reports;
begin
  if not is_staff() then
    raise exception 'staff only';
  end if;

  update fault_reports
    set status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_report_id
    returning * into v_report;

  if not found then
    raise exception 'fault report not found';
  end if;

  select role into v_actor_role from profiles where id = v_user;
  insert into audit_log (actor_id, actor_role, action, point_id, details)
  values (v_user, v_actor_role, 'dismiss_fault_report', v_report.point_id,
    jsonb_build_object('report_id', p_report_id));

  return v_report;
end;
$$;

create or replace function close_maintenance_ticket(
  p_ticket_id uuid,
  p_resolution_notes text default null,
  p_mark_working boolean default true
)
returns maintenance_tickets
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_actor_role user_role;
  v_ticket maintenance_tickets;
begin
  if not is_staff() then
    raise exception 'staff only';
  end if;

  update maintenance_tickets
    set status = 'closed', closed_at = now(), closed_by = auth.uid(),
        resolution_notes = p_resolution_notes
    where id = p_ticket_id and status = 'open'
    returning * into v_ticket;

  if not found then
    raise exception 'ticket not found or already closed';
  end if;

  if p_mark_working then
    update charging_points set health_status = 'working' where id = v_ticket.point_id;
  end if;

  select role into v_actor_role from profiles where id = v_user;
  insert into audit_log (actor_id, actor_role, action, point_id, details)
  values (v_user, v_actor_role, 'close_maintenance_ticket', v_ticket.point_id,
    jsonb_build_object('ticket_id', p_ticket_id, 'mark_working', p_mark_working));

  return v_ticket;
end;
$$;

revoke execute on function set_user_role from public;
grant execute on function set_user_role to authenticated;
