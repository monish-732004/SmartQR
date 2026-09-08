-- Lets librarians/admins set a password after their first magic-link
-- login, so day-to-day sign-in doesn't need an email round trip every
-- time. Students keep email-only magic-link login.

alter table profiles add column if not exists has_password boolean not null default false;

-- Security fix, found while wiring this up: `profiles_update_own` (from
-- 0001_init.sql) restricts UPDATE by ROW (id = auth.uid()) but never
-- restricted which COLUMNS a user can change on their own row — so any
-- authenticated user could currently run
--   update profiles set role = 'admin' where id = auth.uid()
-- directly from the browser and self-promote, bypassing set_user_role()'s
-- is_admin() check entirely. Postgres RLS is row-scoped, not
-- column-scoped, so the real fix is a column-level GRANT: only
-- full_name is self-editable via a plain client update. role changes
-- still go through set_user_role() (SECURITY DEFINER, runs as table
-- owner, unaffected by this grant); has_password is flipped by
-- mark_password_set() below the same way.
revoke update on profiles from authenticated;
grant update (full_name) on profiles to authenticated;

create or replace function mark_password_set()
returns void
security definer set search_path = public
language plpgsql as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update profiles set has_password = true where id = auth.uid();
end;
$$;

revoke execute on function mark_password_set from public;
grant execute on function mark_password_set to authenticated;
