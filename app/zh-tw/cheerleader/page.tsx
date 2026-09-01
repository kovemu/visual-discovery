import type { Metadata } from "next";

import Header from "@/components/Header";
import DiscoverFeed from "@/components/discover/DiscoverFeed";
import {
  cheerleaderLandingHreflang,
  zhTwCheerleaderLanding,
} from "@/lib/seo/cheerleaderLanding";

export const metadata: Metadata = {
  title: zhTwCheerleaderLanding.title,
  description: zhTwCheerleaderLanding.description,
  alternates: {
    canonical: zhTwCheerleaderLanding.canonical,
    languages: cheerleaderLandingHreflang,
  },
  openGraph: {
    title: zhTwCheerleaderLanding.title,
    description: zhTwCheerleaderLanding.description,
    url: zhTwCheerleaderLanding.canonical,
    locale: zhTwCheerleaderLanding.openGraphLocale,
    siteName: "KOVEMU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: zhTwCheerleaderLanding.title,
    description: zhTwCheerleaderLanding.description,
  },
};

export default function ZhTwCheerleaderLandingPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 md:px-10 lg:pb-12 lg:pt-9 xl:pr-[88px]">
        <div lang="zh-TW" className="mb-[22px]">
          <h1 className="text-xl font-semibold leading-tight text-white/[0.94]">
            {zhTwCheerleaderLanding.h1}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/[0.52]">
            {zhTwCheerleaderLanding.intro}
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
