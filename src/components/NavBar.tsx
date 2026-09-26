import Link from "next/link";
import { getProfile, isAdmin, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import ScanQrButton from "@/components/ScanQrButton";
import PresenceTracker from "@/components/PresenceTracker";

const ROLE_STYLES: Record<string, string> = {
  student: "bg-sky-100 text-sky-700",
  librarian: "bg-violet-100 text-violet-700",
  admin: "bg-gradient-to-r from-fuchsia-500 to-orange-400 text-white",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative py-1 font-medium text-neutral-800 transition-colors hover:text-violet-700"
    >
      {children}
      <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 rounded-full bg-gradient-to-r from-violet-500 to-sky-500 transition-all duration-200 group-hover:w-full" />
    </Link>
  );
}

export default async function NavBar() {
  const profile = await getProfile();
  if (!profile) return null;

  const staff = isStaff(profile);
  const admin = isAdmin(profile);

  let floorName: string | null = null;
  if (profile.role === "librarian" && profile.floor_id) {
    const supabase = await createClient();
    const { data: floor } = await supabase
      .from("floors")
      .select("name")
      .eq("id", profile.floor_id)
      .single();
    floorName = floor?.name ?? null;
  }

  return (
    <>
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white shadow-sm">
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/floors" className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="SmartPlug QR" className="h-8 w-auto" />
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 bg-clip-text font-semibold text-transparent">
              SmartPlug QR
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-neutral-800">
            <Link href="/account" className="flex items-center gap-3 hover:opacity-80" title="My profile">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[profile.role]}`}
              >
                {profile.role}
              </span>
              {floorName && (
                <span className="hidden text-xs text-neutral-400 sm:inline">
                  {floorName}
                </span>
              )}
              <span className="hidden sm:inline">{profile.email}</span>
            </Link>
            {staff && (
              <Link
                href="/account/set-password"
                title={profile.has_password ? "Change password" : "Set a password"}
                className="text-xs text-neutral-400 hover:text-violet-700"
              >
                🔑
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
        <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <NavLink href="/floors">Floors</NavLink>
          {!staff && <NavLink href="/dashboard">My dashboard</NavLink>}
          {staff && (
            <>
              <NavLink href="/librarian">Overview</NavLink>
              <NavLink href="/librarian/students">Students</NavLink>
              <NavLink href="/librarian/reports">Reports</NavLink>
              <NavLink href="/librarian/qr-codes">QR codes</NavLink>
            </>
          )}
          {admin && (
            <>
              <NavLink href="/admin">Admin</NavLink>
              <NavLink href="/admin/users">Users</NavLink>
              <NavLink href="/admin/incidents">Incident reviews</NavLink>
              <NavLink href="/admin/activity">Activity</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
    {!staff && (
      <div className="sm:hidden">
        <ScanQrButton floating />
      </div>
    )}
    {profile.role === "student" && (
      <PresenceTracker
        userId={profile.id}
        name={profile.full_name ?? profile.email}
        email={profile.email}
        registrationId={profile.registration_id ?? null}
      />
    )}
    </>
  );
}
