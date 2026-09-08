-- Librarians become floor-scoped: each librarian is assigned to exactly
-- one floor and can only see/manage that floor's points, fault reports,
-- and maintenance tickets. Admins are unrestricted (unchanged). Also adds
-- registration-ID login (an alternative to email) for staff accounts
-- that don't necessarily have a usable inbox — e.g. accounts an admin
-- provisions directly, like the three per-floor librarians.

alter table profiles add column if not exists floor_id uuid references floors (id);
alter table profiles add column if not exists registration_id text unique;

create index if not exists idx_profiles_floor on profiles (floor_id);

-- profiles_update_own's column grant (full_name only, from 0007) already
-- excludes these two new columns by default — no self-service edits to
-- floor_id/registration_id, same reasoning as role/has_password.

-- Resolves a registration ID to its account's email, so the login page
-- can look it up *before* a session exists (this runs as anon) and then
-- call the normal password sign-in with the resolved email. Returns
-- nothing else about the account — just enough to complete the sign-in.
create or replace function email_for_registration_id(p_registration_id text)
returns text
security definer set search_path = public
language sql stable as $$
  select email from profiles where registration_id = p_registration_id;
$$;

revoke execute on function email_for_registration_id from public;
grant execute on function email_for_registration_id to anon, authenticated;

-- Whether the calling user may manage the given floor: admins always can;
-- a librarian can only for their own assigned floor.
create or replace function can_access_floor(p_floor_id uuid)
returns boolean
security definer set search_path = public
language sql stable as $$
  select
    is_admin()
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'librarian' and floor_id = p_floor_id
    );
$$;

-- Admin-only: assign or change a user's registration ID (e.g. to give an
-- existing account an ID-login option later, outside the initial
-- provisioning script).
create or replace function set_registration_id(p_user_id uuid, p_registration_id text)
returns profiles
security definer set search_path = public
language plpgsql as $$
declare
  v_profile profiles;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;

  update profiles set registration_id = p_registration_id
    where id = p_user_id
    returning * into v_profile;

  if not found then
    raise exception 'user not found';
  end if;

  insert into audit_log (actor_id, actor_role, action, target_user_id, details)
  values (auth.uid(), 'admin', 'set_registration_id', p_user_id,
    jsonb_build_object('registration_id', p_registration_id));

  return v_profile;
end;
$$;

revoke execute on function set_registration_id from public;
grant execute on function set_registration_id to authenticated;

-- set_user_role gains a floor assignment: required when promoting to
-- librarian, cleared for every other role. This changes its signature
-- (adds p_floor_id), so the old 2-arg version from 0005 has to be
-- dropped explicitly — CREATE OR REPLACE only replaces an exact
-- signature match; otherwise both would exist as overloads, and a
-- 2-arg call would silently resolve to the old one and skip the floor
-- requirement entirely.
drop function if exists set_user_role(uuid, user_role);

create or replace function set_user_role(
  p_user_id uuid,
  p_role user_role,
  p_floor_id uuid default null
)
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
  if p_role = 'librarian' and p_floor_id is null then
    raise exception 'a librarian must be assigned a floor';
  end if;

  select role into v_old_role from profiles where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;

  update profiles
    set role = p_role,
        floor_id = case when p_role = 'librarian' then p_floor_id else null end
    where id = p_user_id
    returning * into v_profile;

  insert into audit_log (actor_id, actor_role, action, target_user_id, details)
  values (auth.uid(), 'admin', 'set_user_role', p_user_id,
    jsonb_build_object('from', v_old_role, 'to', p_role, 'floor_id', p_floor_id));

  return v_profile;
end;
$$;

-- Re-scope the staff RPC functions to per-floor access instead of
-- blanket is_staff(). Same bodies as 0002/0005 otherwise.

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
  select * into v_before from charging_points where id = p_point_id;
  if not found then
    raise exception 'charging point not found';
  end if;
  if not can_access_floor(v_before.floor_id) then
    raise exception 'not authorized for this floor';
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
  v_point_floor uuid;
  v_ticket maintenance_tickets;
begin
  select point_id into v_point_id from fault_reports where id = p_report_id;
  if not found then
    raise exception 'fault report not found';
  end if;

  select floor_id into v_point_floor from charging_points where id = v_point_id;
  if not can_access_floor(v_point_floor) then
    raise exception 'not authorized for this floor';
  end if;

  update fault_reports
    set status = 'verified', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_report_id;

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
  v_point_floor uuid;
  v_report fault_reports;
begin
  select floor_id into v_point_floor from charging_points
    where id = (select point_id from fault_reports where id = p_report_id);
  if not can_access_floor(v_point_floor) then
    raise exception 'not authorized for this floor';
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
  v_point_id uuid;
  v_point_floor uuid;
  v_ticket maintenance_tickets;
begin
  select point_id into v_point_id from maintenance_tickets where id = p_ticket_id;
  if not found then
    raise exception 'ticket not found';
  end if;

  select floor_id into v_point_floor from charging_points where id = v_point_id;
  if not can_access_floor(v_point_floor) then
    raise exception 'not authorized for this floor';
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

revoke execute on function set_registration_id, email_for_registration_id from public;
grant execute on function set_user_role(uuid, user_role, uuid) to authenticated;

-- RLS: floor-scope what a librarian can see, not just what the app UI
-- asks for. fault_reports and maintenance_tickets go from "any staff
-- sees everything" to "admins see everything, a librarian sees only
-- their floor's rows". Writes to these tables only ever happen through
-- the SECURITY DEFINER functions above (which now check
-- can_access_floor themselves), so no update/insert/delete policy is
-- needed for the authenticated role here.

drop policy if exists sessions_select_own on sessions;
create policy sessions_select_own on sessions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from charging_points cp
      where cp.id = sessions.point_id and can_access_floor(cp.floor_id)
    )
  );

-- Session end/extension only ever happens through end_charging_session()
-- (SECURITY DEFINER); a plain client update was never actually used for
-- staff, so drop the is_staff() bypass this had.
drop policy if exists sessions_update_own on sessions;
create policy sessions_update_own on sessions for update
  using (user_id = auth.uid());

drop policy if exists fault_reports_select on fault_reports;
create policy fault_reports_select on fault_reports for select
  using (
    reporter_id = auth.uid()
    or exists (
      select 1 from charging_points cp
      where cp.id = fault_reports.point_id and can_access_floor(cp.floor_id)
    )
  );

drop policy if exists fault_reports_update_staff on fault_reports;

drop policy if exists maintenance_tickets_staff on maintenance_tickets;
create policy maintenance_tickets_select on maintenance_tickets for select
  using (
    exists (
      select 1 from charging_points cp
      where cp.id = maintenance_tickets.point_id and can_access_floor(cp.floor_id)
    )
  );

-- Floors themselves (renaming, reordering) stay admin-only — a librarian
-- manages their floor's points, not the floor record.
drop policy if exists floors_write_staff on floors;
create policy floors_write_staff on floors for all
  using (is_admin()) with check (is_admin());

drop policy if exists charging_points_write_staff on charging_points;
create policy charging_points_write_staff on charging_points for update
  using (can_access_floor(floor_id));
