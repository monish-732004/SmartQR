import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import { buildStationUrl } from "@/lib/qr";
import type { ChargingPoint } from "@/lib/types";
import { QrImage } from "./qr-image";

export default async function QrCodesPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const scopedFloorId = !isAdmin(profile) ? profile?.floor_id ?? null : null;

  let query = supabase.from("charging_points").select("*, floors(name)").order("qr_code");
  if (scopedFloorId) query = query.eq("floor_id", scopedFloorId);
  const { data: points } = await query;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const byQrCode = new Map<
    string,
    (ChargingPoint & { floors: { name: string } | null })[]
  >();
  for (const p of ((points as (ChargingPoint & { floors: { name: string } | null })[]) ?? [])) {
    const list = byQrCode.get(p.qr_code) ?? [];
    list.push(p);
    byQrCode.set(p.qr_code, list);
  }
  const stations = [...byQrCode.entries()];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">QR codes</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stations.map(([qrCode, ports]) => {
          const url = buildStationUrl(qrCode, appUrl);
          return (
            <div
              key={qrCode}
              className="rounded-lg border border-neutral-200 bg-white p-4"
            >
              <p className="text-xs text-neutral-500">{ports[0].floors?.name}</p>
              <p className="font-mono font-medium">{qrCode}</p>
              <QrImage
                src={`/qr/${qrCode}.png`}
                alt={`QR code for ${qrCode}`}
                className="mt-2 h-32 w-32 rounded border border-neutral-100 bg-white object-contain"
              />
              <p className="mt-2 text-xs text-neutral-500">
                Ports: {ports.map((p) => p.code).join(", ")}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate text-xs text-blue-600 hover:underline"
              >
                Open scan page ↗
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
