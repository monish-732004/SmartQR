import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ChargingPoint, Floor } from "@/lib/types";

export default async function ScanPreviewPage({
  params,
}: PageProps<"/scan/[code]">) {
  const { code } = await params;

  const supabase = await createClient();
  const { data: point } = await supabase
    .from("charging_points")
    .select("*, floors(name)")
    .eq("qr_code", code)
    .maybeSingle();

  if (!point) notFound();

  const p = point as ChargingPoint & { floors: Floor | null };

  return (
    <div className="mx-auto max-w-sm text-center">
      <p className="text-xs text-neutral-500">{p.floors?.name}</p>
      <h1 className="mb-1 font-mono text-xl font-semibold text-neutral-900">
        {p.code}
      </h1>
      {p.label && <p className="mb-4 text-sm text-neutral-500">{p.label}</p>}

      <p className="mb-6 text-sm text-neutral-500">
        Scan this with your phone&apos;s camera to get in and use this
        socket — this page itself doesn&apos;t grant access.
      </p>

      <div className="mx-auto w-56 overflow-hidden rounded-2xl border-4 border-violet-500/70 bg-white p-3 shadow-lg shadow-violet-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/qr/${code}.png`}
          alt={`QR code for ${p.code}`}
          className="h-full w-full rounded-lg"
        />
      </div>
    </div>
  );
}
