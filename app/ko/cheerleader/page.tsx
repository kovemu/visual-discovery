import type { Metadata } from "next";

import Header from "@/components/Header";
import DiscoverFeed from "@/components/discover/DiscoverFeed";
import {
  cheerleaderLandingHreflang,
  koCheerleaderLanding,
} from "@/lib/seo/cheerleaderLanding";

export const metadata: Metadata = {
  title: koCheerleaderLanding.title,
  description: koCheerleaderLanding.description,
  alternates: {
    canonical: koCheerleaderLanding.canonical,
    languages: cheerleaderLandingHreflang,
  },
  openGraph: {
    title: koCheerleaderLanding.title,
    description: koCheerleaderLanding.description,
    url: koCheerleaderLanding.canonical,
    locale: koCheerleaderLanding.openGraphLocale,
    siteName: "KOVEMU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: koCheerleaderLanding.title,
    description: koCheerleaderLanding.description,
  },
};

export default function KoCheerleaderLandingPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 md:px-10 lg:pb-12 lg:pt-9 xl:pr-[88px]">
        <div lang="ko" className="mb-[22px]">
          <h1 className="text-xl font-semibold leading-tight text-white/[0.94]">
            {koCheerleaderLanding.h1}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/[0.52]">
            {koCheerleaderLanding.intro}
          </p>
        </div>

        <DiscoverFeed
          works={[]}
          initialCategories={["cheer"]}
          hideDiscoverHeading
        />
      </section>
    </main>
  );
}
