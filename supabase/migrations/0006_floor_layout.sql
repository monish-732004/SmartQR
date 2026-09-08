-- Replaces the uniform 10-sockets-per-floor layout with the real one:
--   Ground Floor : 10 sockets x 3 ports = 30
--   First Floor  : 20 sockets x 3 ports = 60
--   Second Floor : 20 sockets x 3 ports = 60
-- (150 ports, 50 sockets total). Also renames the floors to match. Safe to
-- run more than once: renames are idempotent and charging_points is
-- truncated and regenerated from scratch every time.

update floors set name = 'Ground Floor' where sort_order = 1;
update floors set name = 'First Floor' where sort_order = 2;
update floors set name = 'Second Floor' where sort_order = 3;

truncate table charging_points restart identity cascade;

do $$
declare
  floor_rec record;
  socket_count int;
  socket_num int;
  port_num int;
  socket_code text;
  point_code text;
  zone text;
  zones text[] := array[
    'Near entrance', 'Reading room A', 'Reading room B', 'Quiet zone',
    'Group study room', 'Window bay', 'Computer lab', 'Periodicals',
    'Lounge', 'Silent study'
  ];
  avail availability_status;
  health health_status;
  n int := 0;
begin
  for floor_rec in select id, sort_order from floors order by sort_order loop
    socket_count := case floor_rec.sort_order
      when 1 then 10  -- Ground Floor
      when 2 then 20  -- First Floor
      when 3 then 20  -- Second Floor
      else 10
    end;

    for socket_num in 1..socket_count loop
      socket_code := format('F%s-Q%s', floor_rec.sort_order, lpad(socket_num::text, 2, '0'));
      zone := zones[((socket_num - 1) % array_length(zones, 1)) + 1];

      for port_num in 1..3 loop
        n := n + 1;
        point_code := format('%s-P%s', socket_code, lpad(port_num::text, 2, '0'));

        -- Deterministic demo mix, not random: mostly available & working,
        -- with a scattering of occupied/reserved/reported-issue/maintenance.
        avail := case
          when n % 3 = 0 then 'occupied'
          when n % 17 = 0 then 'reserved'
          else 'available'
        end;
        health := case
          when n % 23 = 0 then 'maintenance'
          when n % 11 = 0 then 'reported_issue'
          else 'working'
        end;
        if health = 'maintenance' then
          avail := 'available'; -- a point down for maintenance isn't "in a session"
        end if;

        insert into charging_points (code, qr_code, floor_id, label, availability_status, health_status)
        values (point_code, socket_code, floor_rec.id, zone, avail, health);
      end loop;
    end loop;
  end loop;
end $$;
