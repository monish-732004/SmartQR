import { createHmac, timingSafeEqual } from "crypto";
import { headers } from "next/headers";

/**
 * Every socket prints its own QR code, encoding a signed URL for that
 * port's unique `qr_code`. This is what makes it a socket's
 * cryptographically signed digital identity: a student photographing or
 * retyping a code without the matching signature can't spoof another
 * socket, and the server rejects any code/signature pair it didn't sign.
 */
function secret(): string {
  const s = process.env.QR_SIGNING_SECRET;
  if (!s) throw new Error("QR_SIGNING_SECRET is not set");
  return s;
}

export function signCode(code: string): string {
  return createHmac("sha256", secret()).update(code).digest("base64url");
}

export function verifyCode(code: string, signature: string): boolean {
  const expected = Buffer.from(signCode(code));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Path + signed query string only — for in-app links (e.g. a "Scan Me"
 * shortcut) that should navigate client-side rather than as an external URL. */
export function buildStationPath(qrCode: string): string {
  return `/s/${encodeURIComponent(qrCode)}?sig=${signCode(qrCode)}`;
}

export function buildStationUrl(qrCode: string, appUrl: string): string {
  return new URL(buildStationPath(qrCode), appUrl).toString();
}

/**
 * The app's own origin, derived from the incoming request rather than a
 * hardcoded env var. The librarian/admin "Open scan page" link was pointing
 * at localhost in production because NEXT_PUBLIC_APP_URL wasn't set on the
 * deployment; deriving it from request headers means it's always correct
 * (localhost in dev, whatever Vercel URL or custom domain actually served
 * the request in prod) without depending on that env var staying in sync.
 * Only for live pages — the offline `generate-qr-codes.ts` script (baking
 * URLs into printed QR PNGs) has no request to read and still needs
 * NEXT_PUBLIC_APP_URL set explicitly.
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
