import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type { Floor, Profile } from "@/lib/types";
import UserRoleRow from "./UserRoleRow";

export default async function UsersPage() {
  const profile = await getProfile();
  if (!isAdmin(profile)) redirect("/admin");

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: floors } = await supabase
    .from("floors")
    .select("*")
    .order("sort_order");

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Users</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Assign who&apos;s a librarian or admin. A librarian is scoped to one
        floor — they only see and manage that floor&apos;s points, reports,
        and tickets. Only admins can see this page or change roles here.
      </p>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Registration ID</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Floor</th>
            </tr>
          </thead>
          <tbody>
            {((users as Profile[]) ?? []).map((u) => (
              <UserRoleRow
                key={u.id}
                user={u}
                isSelf={u.id === profile!.id}
                floors={(floors as Floor[]) ?? []}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
