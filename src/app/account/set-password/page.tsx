import { redirect } from "next/navigation";
import { getProfile, isStaff } from "@/lib/auth";
import SetPasswordForm from "./SetPasswordForm";

export default async function SetPasswordPage() {
  const profile = await getProfile();
  if (!isStaff(profile)) redirect("/floors");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">
        {profile!.has_password ? "Change your password" : "Set a password"}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">
        {profile!.has_password
          ? "Update the password you use to sign in."
          : "You signed in with a one-time email link. Set a password now so you can sign in faster next time — you can still use the email link too."}
      </p>
      <SetPasswordForm email={profile!.email} />
    </div>
  );
}
