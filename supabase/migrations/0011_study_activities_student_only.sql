-- Study/work tracking is a student-only feature. Re-declare both
-- functions (same signatures/bodies as 0010) with a role check, so this
-- is enforced server-side rather than only by hiding it in the UI.

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
  if not exists (select 1 from profiles where id = v_user and role = 'student') then
    raise exception 'study tracking is only available to students';
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
  if not exists (select 1 from profiles where id = v_user and role = 'student') then
    raise exception 'study tracking is only available to students';
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
