import { redirect } from "next/navigation";
import { getProfile, isStaff } from "@/lib/auth";

export default async function LibrarianLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!isStaff(profile)) redirect("/floors");

  // Same fix as /admin/layout.tsx — see the comment there.
  return (
    <div className="rounded-2xl bg-white/95 p-6 shadow-lg backdrop-blur-sm sm:p-8">
      {children}
    </div>
  );
}
