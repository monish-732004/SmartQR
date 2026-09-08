-- All state transitions that touch more than one table (start/end a
-- session, file/verify a report, open/close a ticket) go through a
-- SECURITY DEFINER function so the whole transition is one atomic
-- transaction and RLS doesn't need student-writable holes punched into
-- charging_points/maintenance_tickets. Each function does its own
-- auth.uid()/is_staff() check up front instead.

-- Students -------------------------------------------------------------

create or replace function start_charging_session(
  p_point_id uuid,
  p_purpose session_purpose default 'charging_only'
)
returns sessions
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
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

  -- Unique partial indexes on sessions(point_id)/(user_id) where
  -- ended_at is null do the real concurrency control: if two requests
  -- race for the same point, or a student already has an active session
  -- anywhere, the INSERT below raises unique_violation (23505) for the
  -- loser and nothing past this point executes for them.
  insert into sessions (point_id, user_id, purpose)
  values (p_point_id, v_user, p_purpose)
  returning * into v_session;

  update charging_points set availability_status = 'occupied' where id = p_point_id;

  return v_session;
end;
$$;

create or replace function end_charging_session(p_point_id uuid)
returns sessions
security definer set search_path = public
language plpgsql as $$
declare
  v_user uuid := auth.uid();
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
  v_report fault_reports;
  v_corroboration int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into fault_reports (point_id, reporter_id, issue_type, description)
  values (p_point_id, v_user, p_issue_type, p_description)
  returning * into v_report;

  -- A single report only queues for staff review. The point's health
  -- only flips automatically once a second, distinct student corroborates
  -- it within 48h — this is what stops one student from unilaterally
  -- taking a working point offline.
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

  return v_report;
end;
$$;

-- Librarians / admins ----------------------------------------------------

create or replace function correct_point_status(
  p_point_id uuid,
  p_availability availability_status default null,
  p_health health_status default null
)
returns charging_points
security definer set search_path = public
language plpgsql as $$
declare
  v_point charging_points;
begin
  if not is_staff() then
    raise exception 'staff only';
  end if;

  update charging_points
    set availability_status = coalesce(p_availability, availability_status),
        health_status = coalesce(p_health, health_status)
    where id = p_point_id
    returning * into v_point;

  if not found then
    raise exception 'charging point not found';
  end if;

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

  -- Other pending reports for the same point are now redundant with the
  -- ticket we just opened; clear them out of the inbox.
  update fault_reports
    set status = 'verified', reviewed_by = auth.uid(), reviewed_at = now()
    where point_id = v_point_id and status = 'pending' and id <> p_report_id;

  return v_ticket;
end;
$$;

create or replace function dismiss_fault_report(p_report_id uuid)
returns fault_reports
security definer set search_path = public
language plpgsql as $$
declare
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

  return v_ticket;
end;
$$;

revoke execute on function
  start_charging_session, end_charging_session, file_fault_report,
  correct_point_status, verify_fault_report, dismiss_fault_report,
  close_maintenance_ticket
from public;

grant execute on function
  start_charging_session, end_charging_session, file_fault_report,
  correct_point_status, verify_fault_report, dismiss_fault_report,
  close_maintenance_ticket
to authenticated;
