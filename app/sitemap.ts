import type { MetadataRoute } from "next";

import {
  CHEERLEADER_LANDING_URLS,
} from "@/lib/seo/cheerleaderLanding";
import {
  SUBJECT_LANDING_LOCALES,
  buildSubjectLandingUrl,
  loadIndexableSubjectLandingEntries,
} from "@/lib/seo/subjectLanding";
import { createSubjectAdminClient } from "@/lib/subjects/subjectAdmin";

const BASE_URL = "https://kovemu.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const supabase = createSubjectAdminClient();
  const subjectEntries = supabase
    ? await loadIndexableSubjectLandingEntries(supabase)
    : [];

  const subjectUrls = subjectEntries.flatMap((subject) =>
    SUBJECT_LANDING_LOCALES.map((locale) => ({
      url: buildSubjectLandingUrl(
        locale,
        subject.category,
        subject.slug,
      ),
      lastModified,
    })),
  );

  return [
    {
      url: BASE_URL,
      lastModified,
    },
    {
      url: CHEERLEADER_LANDING_URLS.ko,
      lastModified,
    },
    {
      url: CHEERLEADER_LANDING_URLS.zhTw,
      lastModified,
    },
    ...subjectUrls,
    {
      url: `${BASE_URL}/privacy`,
      lastModified,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified,
    },
  ];
}
