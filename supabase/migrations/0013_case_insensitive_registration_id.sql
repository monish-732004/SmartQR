-- Mobile keyboards auto-capitalize the first letter of a text input by
-- default, which broke registration-ID password login on phones (e.g.
-- "Lib-ground" typed against a stored "LIB-GROUND" never matched). The
-- login form now also disables autocapitalize/autocorrect, but this is
-- the real fix: the lookup itself becomes case-insensitive, so it can't
-- break again regardless of what a given keyboard or browser does.
create or replace function email_for_registration_id(p_registration_id text)
returns text
security definer set search_path = public
language sql stable as $$
  select email from profiles where upper(registration_id) = upper(p_registration_id);
$$;
