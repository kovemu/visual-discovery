import Header from "@/components/Header";
import PrivacyPolicyContent from "@/components/legal/PrivacyPolicyContent";
import { LEGAL_EFFECTIVE_DATE } from "@/components/legal/constants";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <article className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-600">
          Legal
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950">
          Privacy Policy
        </h1>

        <p className="mt-3 text-sm text-gray-500">
          Effective date: {LEGAL_EFFECTIVE_DATE}
        </p>

        <div className="mt-10">
          <PrivacyPolicyContent />
        </div>

        <div className="mt-12 border-t border-gray-200 pt-8 text-sm text-gray-500">
          <Link
            href="/terms"
            className="font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
          >
            Terms of Service
          </Link>
        </div>
      </article>
    </main>
  );
}
