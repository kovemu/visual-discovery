import type { Metadata } from "next";
import { notFound } from "next/navigation";

import SubjectDiscoverLanding from "@/components/discover/SubjectDiscoverLanding";
import { createSubjectAdminClient } from "@/lib/subjects/subjectAdmin";
import {
  loadSubjectLandingPageData,
  type SubjectLandingCategory,
  type SubjectLandingLocale,
} from "@/lib/seo/subjectLanding";

type SubjectLandingRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function createSubjectLandingRoute(
  category: SubjectLandingCategory,
  locale: SubjectLandingLocale,
) {
  async function loadPage(slug: string) {
    const supabase = createSubjectAdminClient();

    if (!supabase) {
      return null;
    }

    return loadSubjectLandingPageData(
      supabase,
      category,
      slug,
      locale,
    );
  }

  async function generateMetadata({
    params,
  }: SubjectLandingRouteProps): Promise<Metadata> {
    const { slug } = await params;
    const page = await loadPage(slug);

    if (!page) {
      return {
        title: "Kovemu",
        robots: {
          index: false,
          follow: true,
        },
      };
    }

    return page.metadata;
  }

  async function Page({ params }: SubjectLandingRouteProps) {
    const { slug } = await params;
    const page = await loadPage(slug);

    if (!page) {
      notFound();
    }

    return <SubjectDiscoverLanding page={page} />;
  }

  return {
    generateMetadata,
    Page,
  };
}
