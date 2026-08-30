import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import LoginForm from "@/components/LoginForm";
import { getSafeNextPath } from "@/lib/auth/safeNextPath";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

function AuthShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-12 sm:px-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block text-[34px] font-black leading-none text-fuchsia-600 transition hover:text-fuchsia-700"
          >
            Kovemu
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    next?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell>
      <LoginForm
        mode="login"
        presentation="page"
        accountCreated={
          params.created === "1"
        }
        linkError={params.error === "auth"}
        nextPath={getSafeNextPath(params.next)}
      />
    </AuthShell>
  );
}
