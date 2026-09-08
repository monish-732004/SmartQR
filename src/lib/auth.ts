import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export function isAllowedEmail(email: string): boolean {
  const domains = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (domains.length === 0) return true; // no restriction configured

  const emailDomain = email.split("@")[1]?.toLowerCase();
  return domains.includes(emailDomain ?? "");
}

/** Current signed-in user's profile, or null if not signed in. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

export function isStaff(profile: Profile | null): boolean {
  return profile?.role === "librarian" || profile?.role === "admin";
}

/** Super admin: can assign librarian roles and read the audit log. */
export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}
