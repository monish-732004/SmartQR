"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

type CameraState = "starting" | "scanning" | "denied" | "unsupported" | "error";

/**
 * Station QR codes encode a signed URL like https://host/s/<code>?sig=<sig>.
 * Only the path + query is used, so a code printed for another host (e.g.
 * localhost or an older deployment) still opens the station on this site.
 */
function stationPathFromScan(text: string): string | null {
  try {
    const url = new URL(text.trim());
    if (!/^\/s\/[^/]+\/?$/.test(url.pathname)) return null;
    if (!url.searchParams.get("sig")) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function Scanner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const handledRef = useRef(false);
  const [state, setState] = useState<CameraState>("starting");
  const [hint, setHint] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        return;
      }

      let stream: MediaStream;
      try {
        // Rear camera by default; falls back to whatever camera exists.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException).name;
        setState(
          name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error"
        );
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true"); // iOS: don't go fullscreen
      await video.play().catch(() => {});
      setState("scanning");

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

      const tick = () => {
        if (cancelled || handledRef.current) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(img.data, img.width, img.height, {
            inversionAttempts: "dontInvert",
          });
          if (result?.data) {
            const path = stationPathFromScan(result.data);
            if (path) {
              handledRef.current = true;
              stop();
              router.push(path);
              onClose();
              return;
            }
            setHint("That QR code isn't a SmartPlug station. Try the one on the charger.");
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [attempt, router, onClose, stop]);

  // Retrying re-runs the effect above.
  function retry() {
    handledRef.current = false;
    setHint(null);
    setState("starting");
    setAttempt((n) => n + 1);
  }

  const failed = state === "denied" || state === "unsupported" || state === "error";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR code"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="font-medium">Scan QR Code</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
        >
          Close Scanner
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`h-full w-full object-cover ${failed ? "hidden" : ""}`}
        />

        {state === "scanning" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-64 w-64 max-w-[70vw] rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>
        )}

        {state === "starting" && (
          <p className="absolute text-sm text-white/80">Starting camera…</p>
        )}

        {failed && (
          <div className="mx-6 max-w-sm rounded-xl bg-white p-5 text-center">
            <p className="font-semibold text-neutral-900">
              {state === "denied"
                ? "Camera access was blocked"
                : state === "unsupported"
                  ? "Camera isn't available here"
                  : "Couldn't start the camera"}
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              {state === "denied"
                ? "Allow camera access for this site in your browser's site settings (the lock icon next to the address), then try again."
                : state === "unsupported"
                  ? "Scanning needs a camera and a secure (https) connection. Open the site over https, or scan the QR code with your phone's camera app instead."
                  : "Another app may be using the camera. Close it and try again."}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {state !== "unsupported" && (
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="min-h-[3.5rem] px-6 py-4 text-center text-sm text-white/90">
        {state === "scanning"
          ? (hint ?? "Point your camera at the QR code on the charging station.")
          : ""}
      </p>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export default function ScanQrButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-transform active:scale-[0.98] sm:w-auto ${className}`}
      >
        <CameraIcon />
        Scan QR Code
      </button>
      {open && <Scanner onClose={close} />}
    </>
  );
}
