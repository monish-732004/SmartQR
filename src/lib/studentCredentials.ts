import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function randomString(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export interface StudentCredentials {
  registrationId: string;
  password: string;
}

/**
 * A student's first login is always the email magic link. Right after
 * that succeeds, this generates a registration_id + password for them
 * and sets it on their auth account — every login after this can use
 * the Password tab instead. The caller is responsible for showing the
 * returned password to the student once; it's never stored in plaintext.
 *
 * Safe to call on every login: the has_password flip below only ever
 * succeeds for the first caller, so a second concurrent request (e.g. a
 * double-click) is a no-op and returns null.
 */
export async function provisionStudentCredentials(
  userId: string
): Promise<StudentCredentials | null> {
  const admin = createAdminClient();

  // Race guard: only the request that flips has_password false -> true
  // proceeds. A student never loses the ability to sign in either way —
  // the email magic link doesn't depend on this flag.
  const { data: claimed } = await admin
    .from("profiles")
    .update({ has_password: true })
    .eq("id", userId)
    .eq("has_password", false)
    .select("id")
    .maybeSingle();

  if (!claimed) return null;

  let registrationId: string | null = null;
  for (let attempt = 0; attempt < 5 && !registrationId; attempt++) {
    const candidate = `STU-${randomString(6).toUpperCase()}`;
    const { error } = await admin
      .from("profiles")
      .update({ registration_id: candidate })
      .eq("id", userId);
    if (!error) {
      registrationId = candidate;
    } else if (error.code !== "23505") {
      console.error("Failed to set student registration_id:", error.message);
      return null;
    }
  }
  if (!registrationId) {
    console.error("Could not generate a unique registration_id for", userId);
    return null;
  }

  const password = randomString(12);
  const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password });
  if (pwError) {
    console.error("Failed to set student password:", pwError.message);
    return null;
  }

  await admin.from("audit_log").insert({
    actor_id: userId,
    actor_role: "student",
    action: "provision_student_credentials",
    target_user_id: userId,
    details: { registration_id: registrationId },
  });

  return { registrationId, password };
}
