"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SCAN_DURATION_MS = 1600;

export default function ScanRedirect({
  qrCode,
  destination,
  portCount,
}: {
  qrCode: string;
  destination: string;
  portCount: number;
}) {
  const router = useRouter();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const scanTimer = setTimeout(() => setScanned(true), SCAN_DURATION_MS);
    const navTimer = setTimeout(() => router.replace(destination), SCAN_DURATION_MS + 400);
    return () => {
      clearTimeout(scanTimer);
      clearTimeout(navTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-56 overflow-hidden rounded-2xl border-4 border-violet-500/70 bg-white p-3 shadow-lg shadow-violet-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/qr/${qrCode}.png`}
          alt={`QR code for ${qrCode}`}
          className="h-full w-full rounded-lg"
        />
        {!scanned && (
          <div className="pointer-events-none absolute inset-3 overflow-hidden rounded-lg">
            <div className="animate-scan-sweep h-1/3 w-full bg-gradient-to-b from-transparent via-emerald-400/70 to-transparent" />
          </div>
        )}
        {scanned && (
          <div className="animate-pop-in absolute inset-0 flex items-center justify-center rounded-2xl bg-emerald-500/90">
            <span className="text-4xl">✅</span>
          </div>
        )}
      </div>

      <p className="text-sm font-medium text-neutral-700">
        {scanned ? "Scanned!" : "Scanning…"}
      </p>
      <p className="text-xs text-neutral-500">
        {portCount} port{portCount === 1 ? "" : "s"} at this station
      </p>

      <button
        onClick={() => router.replace(destination)}
        className="mt-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition-transform hover:scale-105"
      >
        Skip →
      </button>
    </div>
  );
}
