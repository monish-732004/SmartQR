-- Switch from one shared QR code per physical station (2-3 sockets under
-- one printed code, requiring a manual "pick your port" step after
-- scanning) to one QR code per individual socket. `code` is already the
-- unique per-port identifier, so reusing it as qr_code makes a scan
-- identify exactly one socket directly — no other schema change needed,
-- every existing query/RPC keyed on qr_code or code keeps working as-is.
update charging_points set qr_code = code;

alter table charging_points add constraint charging_points_qr_code_unique unique (qr_code);
