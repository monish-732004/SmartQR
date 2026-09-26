-- A port can be marked "available" (e.g. a librarian status correction, or a
-- manual edit) while an old session on it is still open. The partial unique
-- index uniq_active_session_per_point then rejects every new start, even though
-- the port is free. The port's status is what people see and correct, so when a
-- port is marked available, any session still open on it is stale: close it
-- (audit-logged) and let the new session start.

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
  v_availability availability_status;
  v_session sessions;
  v_stale record;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if is_restricted(v_user, 'sockets') then
    raise exception 'you are restricted from using library sockets';
  end if;

  select health_status, availability_status into v_health, v_availability
  from charging_points where id = p_point_id for update;

  if not found then
    raise exception 'charging point not found';
  end if;
  if v_health = 'maintenance' then
    raise exception 'this point is under maintenance';
  end if;

  if v_availability = 'available' then
    for v_stale in
      with closed as (
        update sessions
        set ended_at = now()
        where point_id = p_point_id and ended_at is null
        returning id, user_id
      )
      select id, user_id from closed
    loop
      insert into audit_log (actor_id, actor_role, action, point_id, target_user_id, details)
      values (v_user, (select role from profiles where id = v_user),
        'auto_close_stale_session', p_point_id, v_stale.user_id,
        jsonb_build_object('session_id', v_stale.id));
    end loop;
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
