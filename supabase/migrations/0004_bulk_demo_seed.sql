-- Replaces the small hand-written demo set with a realistic-scale one:
-- every floor gets 10 sockets (each a physical station with one shared QR
-- code — a "socket" in the product's own terms), and each socket has 10
-- ports. That's 100 ports per floor, 300 total across the 3 seeded floors.
--
-- Safe to run more than once: it truncates charging_points (which cascades
-- to sessions/fault_reports/maintenance_tickets, since those reference it)
-- and regenerates from scratch every time. Run this AFTER
-- 0003_qr_groups_and_realtime.sql, since it needs the qr_code column.

truncate table charging_points restart identity cascade;

do $$
declare
  floor_rec record;
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
    for socket_num in 1..10 loop
      socket_code := format('F%s-Q%s', floor_rec.sort_order, lpad(socket_num::text, 2, '0'));
      zone := zones[socket_num];

      for port_num in 1..10 loop
        n := n + 1;
        point_code := format('%s-P%s', socket_code, lpad(port_num::text, 2, '0'));

        -- Deterministic demo mix, not random, so the seed is reproducible:
        -- mostly available & working, with a scattering of occupied,
        -- reserved, reported-issue, and maintenance ports so the floors
        -- look like a real library rather than an all-green grid.
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
