import { redirect } from "next/navigation";
import { getProfile, isAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!isAdmin(profile)) redirect("/floors");

  return <>{children}</>;
}
