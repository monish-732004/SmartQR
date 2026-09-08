-- A physical charging station has multiple sockets ("ports") but only one
-- printed QR code. qr_code is the shared grouping key: several
-- charging_points rows (each still individually tracked — own status, own
-- sessions, own fault reports) can carry the same qr_code. Scanning that
-- QR opens /s/[qr_code], which lists every port in the group.
alter table charging_points add column if not exists qr_code text;

-- Backfill the existing seeded demo points into shared-QR groups of a few
-- ports each, so the hosted project you already seeded doesn't need a
-- fresh reseed. New installs get qr_code set directly in supabase/seed.sql.
update charging_points set qr_code = case code
  when 'F1-P01' then 'F1-Q01' when 'F1-P02' then 'F1-Q01' when 'F1-P03' then 'F1-Q01'
  when 'F1-P04' then 'F1-Q02' when 'F1-P05' then 'F1-Q02' when 'F1-P06' then 'F1-Q02'
  when 'F2-P01' then 'F2-Q01' when 'F2-P02' then 'F2-Q01' when 'F2-P03' then 'F2-Q01'
  when 'F2-P04' then 'F2-Q02' when 'F2-P05' then 'F2-Q02' when 'F2-P06' then 'F2-Q02'
  when 'F2-P07' then 'F2-Q03'
  when 'F3-P01' then 'F3-Q01' when 'F3-P02' then 'F3-Q01' when 'F3-P03' then 'F3-Q01'
  when 'F3-P04' then 'F3-Q02' when 'F3-P05' then 'F3-Q02'
  else code -- any point outside the seed list becomes its own single-port group
end
where qr_code is null;

alter table charging_points alter column qr_code set not null;
create index if not exists idx_charging_points_qr_code on charging_points (qr_code);

-- Broadcast row changes on charging_points to subscribed clients (student
-- floor views, the admin dashboard) so status flips propagate live instead
-- of waiting for a page refresh. Realtime still enforces the table's RLS
-- select policy per-subscriber, so this doesn't loosen access.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'charging_points'
  ) then
    alter publication supabase_realtime add table charging_points;
  end if;
end $$;
