import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth/requireAdmin";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    if (auth.reason === "unauthenticated") {
      redirect("/login?next=/admin");
    }

    notFound();
  }

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <div className="border-b border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-6 py-3">
          <Link
            href="/admin/artists"
            className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950"
          >
            Artists
          </Link>
          <Link
            href="/admin/ai-import"
            className="rounded-lg bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
          >
            AI Import Review
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
