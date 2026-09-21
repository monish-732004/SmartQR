import Link from "next/link";

const LINKS = [
  {
    href: "/admin/users",
    title: "Users",
    description: "Assign librarian/admin roles and floors.",
  },
  {
    href: "/admin/incidents",
    title: "Incident reviews",
    description: "Review librarian reports and manage student restrictions.",
  },
  {
    href: "/admin/activity",
    title: "Activity",
    description: "Full audit log of student and staff actions.",
  },
];

export default function AdminPage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Admin</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Super admin tools. For day-to-day floor operations, see the{" "}
        <Link href="/librarian" className="text-violet-700 hover:underline">
          librarian workspace
        </Link>
        .
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400"
          >
            <h2 className="font-medium">{link.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
