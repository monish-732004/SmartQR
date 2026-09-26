import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEmail } from "@/lib/auth";
import { provisionStudentCredentials } from "@/lib/studentCredentials";

// Email-free student sign-up. Supabase's built-in mailer is heavily rate
// limited, so instead of sending a magic link we create the account with the
// email pre-confirmed and hand back a generated registration ID + password.
// Existing accounts are never touched, so nobody can take over someone
// else's email through this route.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (!isAllowedEmail(email)) {
    return NextResponse.json(
      { error: "Please use your institutional email." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (error || !data.user) {
    const exists = error?.message.toLowerCase().includes("already");
    return NextResponse.json(
      {
        error: exists
          ? "An account already exists for this email. Sign in with your login ID and password."
          : (error?.message ?? "Could not create account."),
      },
      { status: exists ? 409 : 500 }
    );
  }

  const credentials = await provisionStudentCredentials(data.user.id);
  if (!credentials) {
    return NextResponse.json(
      { error: "Account created but credentials could not be generated. Contact the library." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ email, password: credentials.password });
  response.cookies.set("sq_new_credentials", JSON.stringify(credentials), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}
