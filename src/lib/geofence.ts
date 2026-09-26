import "server-only";

export interface ClientLocation {
  lat: number;
  lng: number;
  /** GPS accuracy radius in meters, as reported by the device. */
  accuracy?: number;
}

export type GeofenceResult = { ok: true } | { ok: false; message: string };

function config() {
  const lat = Number(process.env.LIBRARY_LAT);
  const lng = Number(process.env.LIBRARY_LNG);
  const radius = Number(process.env.LIBRARY_RADIUS_METERS ?? 150);
  if (!process.env.LIBRARY_LAT || !process.env.LIBRARY_LNG) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, radius: Number.isFinite(radius) && radius > 0 ? radius : 150 };
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Checks the student is physically at the library before a session starts,
 * so scanning a photo of a QR code from home can't mark a socket in use.
 * Enforced only when LIBRARY_LAT / LIBRARY_LNG are set, so an unconfigured
 * deployment keeps working.
 */
export function checkAtLibrary(location: ClientLocation | null | undefined): GeofenceResult {
  const cfg = config();
  if (!cfg) return { ok: true };

  if (
    !location ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng) ||
    Math.abs(location.lat) > 90 ||
    Math.abs(location.lng) > 180
  ) {
    return {
      ok: false,
      message: "Turn on location so we can confirm you're at the library.",
    };
  }

  // Forgive some GPS error (indoors especially), but cap it so a huge
  // reported accuracy can't be used to pass from anywhere.
  const slack = Math.min(Math.max(location.accuracy ?? 0, 0), 100);
  const distance = distanceMeters(cfg.lat, cfg.lng, location.lat, location.lng);

  if (distance - slack > cfg.radius) {
    const away =
      distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
    return {
      ok: false,
      message: `You're about ${away} from the library. Go to the charging station and try again.`,
    };
  }
  return { ok: true };
}
