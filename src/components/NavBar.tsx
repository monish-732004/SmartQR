import Link from "next/link";
import { getProfile, isAdmin, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

const ROLE_STYLES: Record<string, string> = {
  student: "bg-sky-100 text-sky-700",
  librarian: "bg-violet-100 text-violet-700",
  admin: "bg-gradient-to-r from-fuchsia-500 to-orange-400 text-white",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative py-1 text-neutral-600 transition-colors hover:text-violet-700"
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
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/floors"
            className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 bg-clip-text font-semibold text-transparent"
          >
            ⚡ SmartPlug QR
          </Link>
          <nav className="flex gap-4 text-sm">
            <NavLink href="/floors">Floors</NavLink>
            <NavLink href="/dashboard">My dashboard</NavLink>
            {staff && (
              <>
                <NavLink href="/admin">Admin</NavLink>
                <NavLink href="/admin/reports">Reports</NavLink>
                <NavLink href="/admin/analytics">Analytics</NavLink>
                <NavLink href="/admin/qr-codes">QR codes</NavLink>
              </>
            )}
            {admin && (
              <>
                <NavLink href="/admin/users">Users</NavLink>
                <NavLink href="/admin/activity">Activity</NavLink>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-600">
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
          {staff && (
            <Link
              href="/account/set-password"
              title={profile.has_password ? "Change password" : "Set a password"}
              className="text-xs text-neutral-400 hover:text-violet-700"
            >
              🔑
            </Link>
          )}
          <span className="hidden sm:inline">{profile.email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
