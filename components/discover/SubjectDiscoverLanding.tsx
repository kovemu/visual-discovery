import Header from "@/components/Header";
import DiscoverFeed from "@/components/discover/DiscoverFeed";
import {
  htmlLangForSubjectLocale,
  type SubjectLandingPageData,
} from "@/lib/seo/subjectLanding";

export default function SubjectDiscoverLanding({
  page,
}: {
  page: SubjectLandingPageData;
}) {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 md:px-10 lg:pb-12 lg:pt-9 xl:pr-[88px]">
        <div
          lang={htmlLangForSubjectLocale(page.locale)}
          className="mb-[22px]"
        >
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-5 w-0.5 shrink-0 rounded-full bg-[#a855f7]"
            />
            <h1 className="text-xl font-semibold leading-tight text-white/[0.94]">
              {page.heading}
            </h1>
          </div>
        </div>

        <DiscoverFeed
          works={[]}
          initialCategories={[page.subject.category]}
          initialSubject={{
            id: page.subject.id,
            slug: page.subject.slug,
            name: page.displayName,
            category: page.subject.category,
          }}
          hideDiscoverHeading
        />
      </section>
    </main>
  );
}
