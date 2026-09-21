import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { provisionStudentCredentials } from "@/lib/studentCredentials";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/floors";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user?.email && !isAllowedEmail(data.user.email)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=domain`);
    }

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, has_password")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "student" && !profile.has_password) {
        const credentials = await provisionStudentCredentials(data.user.id);
        if (credentials) {
          const response = NextResponse.redirect(
            `${origin}/account/welcome?next=${encodeURIComponent(next)}`
          );
          // Short-lived, httpOnly: only the welcome page (read server-side)
          // can see this, and it expires whether or not that page is ever
          // visited. The password is never stored anywhere in plaintext.
          response.cookies.set("sq_new_credentials", JSON.stringify(credentials), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 300,
            path: "/",
          });
          return response;
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
