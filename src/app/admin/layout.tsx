import { redirect } from "next/navigation";
import { getProfile, isStaff } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!isStaff(profile)) redirect("/floors");

  return <>{children}</>;
}
