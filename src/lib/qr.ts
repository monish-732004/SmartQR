import { createHmac, timingSafeEqual } from "crypto";

/**
 * A physical charging station prints one QR code that covers several
 * ports (sockets) — the QR encodes a signed URL for the station's shared
 * `qr_code`, not any single port. This is what makes it a station's
 * "cryptographically signed digital identity": a student photographing or
 * retyping a code without the matching signature can't spoof another
 * station, and the server rejects any code/signature pair it didn't sign.
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
