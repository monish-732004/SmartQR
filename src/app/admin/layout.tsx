import { redirect } from "next/navigation";
import { getProfile, isAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!isAdmin(profile)) redirect("/floors");

  // Admin pages are data-dense (tables, headings, loose paragraph text) and
  // were rendering straight on the site-wide dimmed-photo backdrop with no
  // card behind them — headings/labels with no explicit color class (or
  // just text-neutral-*) were getting forced to white/near-white by the
  // global CSS override in globals.css meant for hero copy, which reads
  // fine on a dark photo but is unreliable once you account for lighter
  // regions of the image. An opaque panel here sidesteps that: `bg-white`
  // is already in that override's "restore to dark text" allowlist, so
  // every admin page gets normal, reliable dark-on-light text for free.
  return (
    <div className="rounded-2xl bg-white/95 p-6 shadow-lg backdrop-blur-sm sm:p-8">
      {children}
    </div>
  );
}
