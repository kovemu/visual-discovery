import Link from "next/link";

import UpdatePasswordForm from "@/components/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-12">
      <div className="w-[calc(100%-32px)] max-w-[420px] rounded-xl border border-white/[0.08] bg-[#111111] p-6 sm:p-8">
        <div className="mb-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2"
            aria-label="KOVEMU home"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-violet-500"
            />
            <span className="text-[13px] font-semibold uppercase tracking-[0.34em] text-white">
              KOVEMU
            </span>
          </Link>
        </div>

        <h1 className="text-center text-xl font-semibold text-white">
          Set a new password
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          Choose a password for your KOVEMU account.
        </p>

        <div className="mt-6">
          <UpdatePasswordForm />
        </div>
      </div>
    </main>
  );
}
