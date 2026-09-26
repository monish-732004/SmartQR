import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextHref =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/floors";

  const cookieStore = await cookies();
  const raw = cookieStore.get("sq_new_credentials")?.value;
  if (!raw) redirect(nextHref);

  let credentials: { registrationId: string; password: string };
  try {
    credentials = JSON.parse(raw);
  } catch {
    redirect(nextHref);
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">You&apos;re in</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Save this password now — it&apos;s shown only once and can&apos;t be
        recovered later. Your login ID stays visible any time in{" "}
        <span className="font-medium text-neutral-700">My profile</span>.
        From now on you can sign in with these instead of the email link
        (the email link still works too).
      </p>

      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
        <p className="text-xs font-medium text-violet-800">Login ID</p>
        <p className="font-mono text-lg text-violet-900">{credentials.registrationId}</p>
        <p className="mt-3 text-xs font-medium text-violet-800">Password</p>
        <p className="font-mono text-lg text-violet-900">{credentials.password}</p>
      </div>

      <Link
        href={nextHref}
        className="mt-6 block rounded-md bg-neutral-900 px-3 py-2.5 text-center text-sm font-medium text-white hover:bg-violet-700"
      >
        Continue →
      </Link>
    </div>
  );
}
