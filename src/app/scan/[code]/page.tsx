import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildStationPath } from "@/lib/qr";
import ScanRedirect from "./ScanRedirect";

export default async function ScanPreviewPage({
  params,
  searchParams,
}: PageProps<"/scan/[code]">) {
  const { code } = await params;
  const { port } = await searchParams;
  const portCode = typeof port === "string" ? port : undefined;

  const supabase = await createClient();
  const { data: points } = await supabase
    .from("charging_points")
    .select("floor_id")
    .eq("qr_code", code);

  if (!points || points.length === 0) notFound();

  const { data: floor } = await supabase
    .from("floors")
    .select("name")
    .eq("id", points[0].floor_id)
    .single();

  const destination = buildStationPath(code) + (portCode ? `#port-${portCode}` : "");

  return (
    <div className="mx-auto max-w-sm text-center">
      <p className="text-xs text-neutral-500">{floor?.name}</p>
      <h1 className="mb-1 font-mono text-xl font-semibold text-neutral-900">
        {portCode ?? code}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">
        This is what a phone camera would see printed on the station.
      </p>

      <ScanRedirect
        qrCode={code}
        destination={destination}
        portCount={points.length}
      />
    </div>
  );
}
