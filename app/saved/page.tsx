import Header from "@/components/Header";
import SavedGrid from "@/components/saved/SavedGrid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function SavedPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 md:px-6 lg:px-8">
        <SavedGrid />
      </section>
    </main>
  );
}
