import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">My profile</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Your login ID lives here for good — look it up any time you forget it.
      </p>

      <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <div>
          <p className="text-xs text-neutral-400">Name</p>
          <p className="font-medium text-neutral-900">{profile.full_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400">Email</p>
          <p className="font-medium text-neutral-900">{profile.email}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400">Role</p>
          <p className="font-medium text-neutral-900 capitalize">{profile.role}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400">Login ID</p>
          {profile.registration_id ? (
            <p className="font-mono text-base font-semibold text-violet-900">
              {profile.registration_id}
            </p>
          ) : (
            <p className="text-neutral-400">
              Not generated yet — sign in with the email link once and one will
              be created automatically.
            </p>
          )}
        </div>
      </div>

      <Link
        href="/account/set-password"
        className="mt-4 inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
      >
        {profile.has_password ? "Change password" : "Set a password"}
      </Link>
    </div>
  );
}
