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
      {children}
    </div>
  );
}
