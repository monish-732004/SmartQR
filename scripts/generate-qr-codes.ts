/**
 * Generates a signed QR code PNG for every charging socket (each
 * charging_points row has its own unique qr_code). Run after seeding:
 * `npm run qr:generate`
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "qr");

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
    );
  }

  // Signing logic lives in src/lib/qr.ts; re-implemented minimally here
  // rather than importing, since this script runs outside the Next.js
  // module graph (plain tsx, no path aliases).
  const { createHmac } = await import("crypto");
  const signingSecret = process.env.QR_SIGNING_SECRET;
  if (!signingSecret) throw new Error("QR_SIGNING_SECRET must be set in .env.local");

  function signCode(code: string): string {
    return createHmac("sha256", signingSecret!).update(code).digest("base64url");
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: points, error } = await supabase
    .from("charging_points")
    .select("qr_code, code")
    .order("qr_code");

  if (error) throw error;
  if (!points || points.length === 0) {
    console.log("No charging points found — run the seed first.");
    return;
  }

  const stations = new Map<string, string[]>();
  for (const { qr_code, code } of points) {
    const list = stations.get(qr_code) ?? [];
    list.push(code);
    stations.set(qr_code, list);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const manifest: Record<string, { url: string; ports: string[] }> = {};

  for (const [qrCode, ports] of stations) {
    const sig = signCode(qrCode);
    const url = new URL(`/s/${encodeURIComponent(qrCode)}`, appUrl);
    url.searchParams.set("sig", sig);

    const filePath = path.join(OUT_DIR, `${qrCode}.png`);
    await QRCode.toFile(filePath, url.toString(), { width: 400, margin: 2 });
    manifest[qrCode] = { url: url.toString(), ports };
    console.log(`✓ ${qrCode} (${ports.join(", ")}) -> ${filePath}`);
  }

  writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`\nGenerated ${stations.size} socket QR codes in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
