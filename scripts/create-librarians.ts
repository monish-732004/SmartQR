/**
 * One-off provisioning: creates the three per-floor librarian accounts
 * directly (no email step — they sign in with a registration ID +
 * password from day one). Run once: `npm run create:librarians`
 *
 * Requires 0008_floor_scoped_librarians.sql to already be applied.
 * Safe to re-run: an account that already exists (by email) is left
 * alone and skipped, so re-running after a partial failure won't
 * duplicate anyone.
 */
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const FLOOR_LIBRARIANS = [
  { floorName: "Ground Floor", registrationId: "LIB-GROUND", email: "librarian.ground@smartplugqr.local" },
  { floorName: "First Floor", registrationId: "LIB-FIRST", email: "librarian.first@smartplugqr.local" },
  { floorName: "Second Floor", registrationId: "LIB-SECOND", email: "librarian.second@smartplugqr.local" },
];

function generatePassword(): string {
  // 12 chars, alphanumeric — easy to read aloud/type, no ambiguous 0/O/1/l.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: floors, error: floorsError } = await supabase
    .from("floors")
    .select("id, name");
  if (floorsError) throw floorsError;

  const results: { floorName: string; registrationId: string; password: string }[] = [];

  for (const entry of FLOOR_LIBRARIANS) {
    const floor = floors?.find((f) => f.name === entry.floorName);
    if (!floor) {
      console.warn(`⚠ Floor "${entry.floorName}" not found — skipping ${entry.registrationId}.`);
      continue;
    }

    // Already provisioned? Skip rather than duplicate.
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("registration_id", entry.registrationId)
      .maybeSingle();
    if (existing) {
      console.log(`= ${entry.registrationId} already exists — skipping.`);
      continue;
    }

    const password = generatePassword();

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: entry.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${entry.floorName} Librarian` },
    });
    if (createError || !created.user) {
      console.error(`✗ Failed to create ${entry.registrationId}:`, createError?.message);
      continue;
    }

    // The handle_new_auth_user trigger already inserted a default
    // ('student', no floor) profile row — fill in the real one here,
    // as the service role (bypasses the column-grant restrictions that
    // apply to a regular authenticated user's own row).
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: "librarian",
        floor_id: floor.id,
        registration_id: entry.registrationId,
        has_password: true,
        full_name: `${entry.floorName} Librarian`,
      })
      .eq("id", created.user.id);
    if (profileError) {
      console.error(`✗ Failed to set up profile for ${entry.registrationId}:`, profileError.message);
      continue;
    }

    results.push({ floorName: entry.floorName, registrationId: entry.registrationId, password });
  }

  if (results.length === 0) {
    console.log("\nNothing to create.");
    return;
  }

  console.log("\n=== Librarian credentials (shown once — save these now) ===\n");
  for (const r of results) {
    console.log(`${r.floorName}`);
    console.log(`  Registration ID : ${r.registrationId}`);
    console.log(`  Password        : ${r.password}`);
    console.log("");
  }
  console.log("Sign in at /login → Password tab, using the registration ID.");
  console.log("Recommend changing the password after first login (🔑 in the nav).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
