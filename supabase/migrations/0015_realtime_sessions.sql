-- Publish sessions to Supabase Realtime so a student starting/ending a session
-- shows up immediately for librarians (who can already read sessions through
-- RLS) and in the student's own dashboard history. Realtime still applies the
-- table's RLS select policy per subscriber.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table sessions;
  end if;
end $$;
