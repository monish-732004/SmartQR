"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archivo_Black } from "next/font/google";
import { createClient } from "@/lib/supabase/client";

const headlineFont = Archivo_Black({ subsets: ["latin"], weight: "400" });

function allowedDomainsLabel(): string {
  const domains = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  return domains.length ? domains.map((d) => `@${d}`).join(", ") : "";
}

// A hand-laid-out grid, not a real (scannable) QR code — three "eye"
// blocks in the classic corners, a few accent squares, and gaps for
// breathing room. '#' = charcoal, 'A' = accent, '.' = empty.
const QR_ROWS = [
  "###...###.",
  "#.#.A.#.#.",
  "###...###.",
  "...#......",
  ".A..#..A..",
  ".....#....",
  "###.....A.",
  "#.#..A....",
  "###.....#.",
  "..A.#....#",
];

function QrGraphic() {
  let filled = 0;
  return (
    <div className="grid grid-cols-10 gap-[3px]">
      {QR_ROWS.flatMap((row, r) =>
        row.split("").map((ch, c) => {
          if (ch === ".") {
            return <div key={`${r}-${c}`} className="h-5 w-5 sm:h-6 sm:w-6" />;
          }
          const delay = filled * 12;
          filled++;
          return (
            <div
              key={`${r}-${c}`}
              className={`animate-pop-in h-5 w-5 rounded-[2px] sm:h-6 sm:w-6 ${
                ch === "A"
                  ? c % 2 === 0
                    ? "bg-violet-600"
                    : "bg-fuchsia-600"
                  : "bg-neutral-900"
              }`}
              style={{ animationDelay: `${delay}ms` }}
            />
          );
        })
      )}
    </div>
  );
}

function MarkerArrow() {
  return (
    <svg
      width="56"
      height="36"
      viewBox="0 0 56 36"
      fill="none"
      className="text-neutral-800"
      aria-hidden
    >
      <path
        d="M3 7C17 3 33 9 47 26"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M39 22.5C42.5 24.5 45.5 26.5 47.5 27C47 24.5 46.5 20.5 46.5 16.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sticker({
  children,
  rotate,
  className = "",
}: {
  children: React.ReactNode;
  rotate: string;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex w-fit flex-col gap-0.5 rounded border border-neutral-300 bg-white px-2.5 py-1.5 font-mono text-[10px] font-medium leading-tight tracking-wider text-neutral-600 shadow-[2px_2px_0_0_rgba(0,0,0,0.05)] ${className}`}
      style={{ transform: `rotate(${rotate})` }}
    >
      {children}
    </div>
  );
}

const STEPS = [
  { label: "SCAN", text: "Scan a SmartPlug QR." },
  { label: "FIND", text: "See where a working charger is." },
  { label: "CHARGE", text: "Plug in and get back to work." },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const domains = allowedDomainsLabel();

  const [loginId, setLoginId] = useState(""); // email OR registration ID
  const [password, setPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<"idle" | "sending" | "error">("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwStatus("sending");
    setPwError(null);

    const supabase = createClient();
    let resolvedEmail = loginId.trim();

    // Not an email? Treat it as a registration ID and resolve it to the
    // account's email first — Supabase's password sign-in only takes an
    // email, so this happens before we can call it.
    if (!resolvedEmail.includes("@")) {
      const { data, error: lookupError } = await supabase.rpc(
        "email_for_registration_id",
        { p_registration_id: resolvedEmail }
      );
      if (lookupError || !data) {
        setPwStatus("error");
        setPwError("No account found for that registration ID.");
        return;
      }
      resolvedEmail = data;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });

    if (error) {
      setPwStatus("error");
      setPwError(
        error.message.includes("Invalid login credentials")
          ? "Wrong credentials — or a password hasn't been set yet. Use the email link instead."
          : error.message
      );
    } else {
      router.push("/floors");
      router.refresh();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const domainList = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (domainList.length && !domainList.includes(emailDomain ?? "")) {
      setStatus("error");
      setError(`Please use your institutional email (${domains}).`);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto px-4 py-6 sm:px-8"
      style={{
        backgroundImage: "url(/ub.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Nav */}
      <div className="mx-auto mb-8 flex max-w-5xl items-center justify-between rounded-xl bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SRM Institute of Science & Technology" className="h-8 w-auto" />
          <span className="font-mono text-sm font-semibold tracking-tight text-neutral-900">
            SmartPlug QR
          </span>
        </div>
        <nav className="flex items-center gap-5 font-mono text-xs uppercase tracking-wider text-neutral-600">
          <a href="#how-it-works" className="hover:text-neutral-900">
            How it works
          </a>
          <a href="#" className="hover:text-neutral-900">
            Help
          </a>
        </nav>
      </div>

      <div className="mx-auto grid max-w-5xl gap-12 pb-16 lg:grid-cols-12 lg:gap-8">
        {/* Left: editorial hero */}
        <div className="rounded-2xl bg-white/80 p-6 shadow-sm backdrop-blur-md sm:p-8 lg:col-span-7">
          <Sticker rotate="-2deg" className="mb-6">
            <span>Campus network</span>
            <span className="flex items-center gap-1 text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Online
            </span>
          </Sticker>

          <h1
            className={`${headlineFont.className} text-4xl leading-[1.05] tracking-tight text-neutral-900 sm:text-5xl`}
          >
            YOUR BATTERY IS LOW.
            <br />
            WE KNOW A PLACE.
          </h1>

          <p className="mt-4 max-w-md text-[15px] text-neutral-600">
            Find a working charger around campus without walking floor to
            floor.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                Battery
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="relative h-4 w-10 rounded-[3px] border-2 border-neutral-900">
                  <div className="absolute top-1/2 -right-[5px] h-2 w-[3px] -translate-y-1/2 rounded-[1px] bg-neutral-900" />
                  <div
                    className="h-full bg-red-500"
                    style={{ width: "7%" }}
                  />
                </div>
                <span className="font-mono text-xs font-semibold text-neutral-900">
                  7%
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Yeah, we&apos;ve all been there.
            </p>
          </div>

          {/* QR graphic */}
          <div className="mt-10 flex flex-wrap items-start gap-6">
            <div className="rounded-lg border border-neutral-200 bg-white/60 p-4">
              <QrGraphic />
            </div>
            <div className="flex max-w-[10rem] flex-col gap-2 pt-2">
              <div className="-scale-x-100">
                <MarkerArrow />
              </div>
              <p className="font-mono text-xs uppercase leading-tight tracking-wider text-neutral-700">
                Scan any
                <br />
                SmartPlug
              </p>
            </div>
          </div>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-400">
            Scan • Find • Charge
          </p>

          {/* 3-step flow */}
          <div id="how-it-works" className="mt-10 grid max-w-lg grid-cols-3 gap-4 scroll-mt-8">
            {STEPS.map((s) => (
              <div key={s.label}>
                <p className="font-mono text-xs font-bold tracking-wider text-violet-700">
                  {s.label}
                </p>
                <p className="mt-1 text-xs leading-snug text-neutral-600">
                  {s.text}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Sticker rotate="1.5deg">
              <span>Built for</span>
              <span>Long library nights</span>
            </Sticker>
            <Sticker rotate="-1deg">
              <span>No more</span>
              <span>&quot;Is this charger working?&quot;</span>
            </Sticker>
          </div>

          <p className="mt-12 text-xs italic text-neutral-400">
            Made for the moments when your battery isn&apos;t.
          </p>
        </div>

        {/* Right: login card */}
        <div className="lg:col-span-5">
          <div className="animate-fade-in mx-auto max-w-sm rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] lg:rotate-[0.4deg]">
            <div className="h-1.5 rounded-t-xl bg-violet-600" />
            <div className="p-7">
              <p className="font-mono text-xs uppercase tracking-wider text-neutral-400">
                Welcome back
              </p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-900">
                Sign in to SmartPlug
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                {mode === "link"
                  ? "Sign in with your institutional email to continue."
                  : "Sign in with your login ID and password."}
              </p>

              <div className="mt-4 flex gap-1 rounded-md bg-neutral-100 p-1 font-mono text-[11px] uppercase tracking-wide">
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setMode("link")}
                  className={`flex-1 rounded px-2 py-1.5 transition-colors ${
                    mode === "link"
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  Email link
                </button>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setMode("password")}
                  className={`flex-1 rounded px-2 py-1.5 transition-colors ${
                    mode === "password"
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  Password
                </button>
              </div>

              {mode === "link" ? (
                status === "sent" ? (
                  <div className="animate-pop-in mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    Check <strong>{email}</strong> for a sign-in link.
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
                    <input
                      type="email"
                      required
                      suppressHydrationWarning
                      placeholder={
                        domains ? `you${domains.split(",")[0]}` : "you@college.edu"
                      }
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-md border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                    />
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      suppressHydrationWarning
                      className="rounded-md bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                    >
                      {status === "sending" ? "Sending link…" : "Send sign-in link →"}
                    </button>
                    {error && (
                      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                      </p>
                    )}
                  </form>
                )
              ) : (
                <form onSubmit={handlePasswordSubmit} className="mt-4 flex flex-col gap-3">
                  <input
                    type="text"
                    required
                    suppressHydrationWarning
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    placeholder="Email or registration ID"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="rounded-md border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                  />
                  <input
                    type="password"
                    required
                    suppressHydrationWarning
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-md border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                  />
                  <button
                    type="submit"
                    disabled={pwStatus === "sending"}
                    suppressHydrationWarning
                    className="rounded-md bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                  >
                    {pwStatus === "sending" ? "Signing in…" : "Sign in →"}
                  </button>
                  {pwError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                      {pwError}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400">
                    No password yet? Sign in with the email link once —
                    we&apos;ll show you a login ID and password to use from
                    then on (staff can also set their own from the account
                    menu).
                  </p>
                </form>
              )}

              <p className="mt-5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Secure institutional login
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="mx-auto mt-2 max-w-5xl">
        <div className="rounded-lg bg-white/80 py-3 text-center text-xs font-medium text-neutral-600 shadow-sm backdrop-blur-md">
          Made by Monish R and Prajith Arjunan S
        </div>
      </footer>
    </div>
  );
}
