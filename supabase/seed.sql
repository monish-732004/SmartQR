-- Sample floors and charging points for local development:
--   Ground Floor : 10 sockets x 3 ports = 30
--   First Floor  : 20 sockets x 3 ports = 60
--   Second Floor : 20 sockets x 3 ports = 60
-- Several ports share a qr_code — that's a physical station with multiple
-- sockets under one printed QR code (scan it, then pick a port). Kept in
-- sync with supabase/migrations/0006_floor_layout.sql, which does the same
-- thing for a hosted project that already ran the earlier migrations.

insert into floors (name, sort_order) values
  ('Ground Floor', 1),
  ('First Floor', 2),
  ('Second Floor', 3);

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
          avail := 'available';
        end if;

        insert into charging_points (code, qr_code, floor_id, label, availability_status, health_status)
        values (point_code, socket_code, floor_rec.id, zone, avail, health);
      end loop;
    end loop;
  end loop;
end $$;
