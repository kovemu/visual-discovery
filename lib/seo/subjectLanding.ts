import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorCategory } from "@/lib/creator/creatorCategories";
import {
  isSubjectCategory,
  isSubjectType,
  type SubjectCategory,
  type SubjectType,
} from "@/lib/subjects/subjectTypes";

const SITE_URL = "https://kovemu.com";
export const SUBJECT_LANDING_MIN_WORKS = 5;
const SUBJECT_WORK_ID_LIMIT = 2000;

export const SUBJECT_LANDING_LOCALES = ["en", "ko", "zh-tw"] as const;
export type SubjectLandingLocale =
  (typeof SUBJECT_LANDING_LOCALES)[number];

export const SUBJECT_LANDING_CATEGORIES = ["cheer", "kpop"] as const;
export type SubjectLandingCategory =
  (typeof SUBJECT_LANDING_CATEGORIES)[number];

export type SubjectLandingRecord = {
  id: string;
  slug: string;
  type: SubjectType;
  category: SubjectLandingCategory;
  name_ko: string | null;
  name_en: string | null;
  name_zh_tw: string | null;
};

export function isSubjectLandingCategory(
  value: unknown,
): value is SubjectLandingCategory {
  return (
    value === "cheer" ||
    value === "kpop"
  );
}

export function subjectLandingPathSegment(
  category: SubjectLandingCategory,
): "cheerleader" | "kpop" {
  return category === "cheer" ? "cheerleader" : "kpop";
}

export function buildSubjectLandingPath(
  locale: SubjectLandingLocale,
  category: SubjectLandingCategory,
  slug: string,
): string {
  const segment = subjectLandingPathSegment(category);

  if (locale === "en") {
    return `/${segment}/${slug}`;
  }

  if (locale === "ko") {
    return `/ko/${segment}/${slug}`;
  }

  return `/zh-tw/${segment}/${slug}`;
}

export function buildSubjectLandingUrl(
  locale: SubjectLandingLocale,
  category: SubjectLandingCategory,
  slug: string,
): string {
  return `${SITE_URL}${buildSubjectLandingPath(locale, category, slug)}`;
}

export function subjectLandingHreflang(
  category: SubjectLandingCategory,
  slug: string,
): Record<string, string> {
  return {
    en: buildSubjectLandingUrl("en", category, slug),
    "ko-KR": buildSubjectLandingUrl("ko", category, slug),
    "zh-TW": buildSubjectLandingUrl("zh-tw", category, slug),
    "x-default": buildSubjectLandingUrl("en", category, slug),
  };
}

export function resolveSubjectDisplayName(
  locale: SubjectLandingLocale,
  subject: Pick<
    SubjectLandingRecord,
    "name_ko" | "name_en" | "name_zh_tw"
  >,
): string {
  if (locale === "ko") {
    return subject.name_ko || subject.name_en || "";
  }

  if (locale === "zh-tw") {
    return (
      subject.name_zh_tw ||
      subject.name_en ||
      subject.name_ko ||
      ""
    );
  }

  return subject.name_en || subject.name_ko || "";
}

export function htmlLangForSubjectLocale(
  locale: SubjectLandingLocale,
): string {
  if (locale === "ko") {
    return "ko";
  }

  if (locale === "zh-tw") {
    return "zh-TW";
  }

  return "en";
}

export function openGraphLocaleForSubject(
  locale: SubjectLandingLocale,
): string {
  if (locale === "ko") {
    return "ko_KR";
  }

  if (locale === "zh-tw") {
    return "zh_TW";
  }

  return "en_US";
}

export function buildSubjectLandingCopy(input: {
  locale: SubjectLandingLocale;
  category: SubjectLandingCategory;
  type: SubjectType;
  name: string;
  groupName?: string | null;
}): {
  title: string;
  description: string;
  h1: string;
} {
  const name = input.name.trim();
  const groupName = input.groupName?.trim() || "";

  if (input.category === "cheer") {
    if (input.locale === "ko") {
      return {
        title: `${name} 치어리더 직캠 | Kovemu`,
        description: `${name} 치어리더의 직캠과 영상을 Kovemu에서 만나보세요.`,
        h1: `${name} 치어리더 직캠`,
      };
    }

    if (input.locale === "zh-tw") {
      return {
        title: `${name} 韓國啦啦隊直拍 | Kovemu`,
        description: `探索${name}的韓國啦啦隊直拍與影片。`,
        h1: `${name} 韓國啦啦隊直拍`,
      };
    }

    return {
      title: `${name} Cheerleader Fancams | Kovemu`,
      description: `Discover ${name} cheerleader fancams and videos on Kovemu.`,
      h1: `${name} Cheerleader Fancams`,
    };
  }

  const groupSuffix = groupName ? ` | ${groupName}` : "";

  if (input.locale === "ko") {
    return {
      title: `${name} 직캠${groupSuffix} | Kovemu`,
      description: `${name}의 직캠과 영상을 Kovemu에서 만나보세요.`,
      h1: `${name} 직캠`,
    };
  }

  if (input.locale === "zh-tw") {
    return {
      title: `${name} 直拍${groupSuffix} | Kovemu`,
      description: `探索${name}的直拍與影片。`,
      h1: `${name} 直拍`,
    };
  }

  return {
    title: `${name} Fancams${groupSuffix} | Kovemu`,
    description: `Discover ${name} fancams and videos on Kovemu.`,
    h1: `${name} Fancams`,
  };
}

export function shouldIndexSubjectLanding(workCount: number): boolean {
  return workCount >= SUBJECT_LANDING_MIN_WORKS;
}

export function buildSubjectLandingMetadata(input: {
  locale: SubjectLandingLocale;
  category: SubjectLandingCategory;
  slug: string;
  title: string;
  description: string;
  indexable: boolean;
}): Metadata {
  const canonical = buildSubjectLandingUrl(
    input.locale,
    input.category,
    input.slug,
  );

  return {
    title: input.title,
    description: input.description,
    robots: {
      index: input.indexable,
      follow: true,
    },
    alternates: {
      canonical,
      languages: subjectLandingHreflang(
        input.category,
        input.slug,
      ),
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      locale: openGraphLocaleForSubject(input.locale),
      siteName: "KOVEMU",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}

function uniquePositiveIds(values: Array<number | string | null | undefined>) {
  const ids = new Set<number>();

  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);

    if (Number.isInteger(parsed) && parsed > 0) {
      ids.add(parsed);
    }
  }

  return [...ids];
}

export async function loadSubjectLandingRecord(
  supabase: SupabaseClient,
  category: SubjectLandingCategory,
  slug: string,
): Promise<SubjectLandingRecord | null> {
  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, slug, type, category, name_ko, name_en, name_zh_tw, active",
    )
    .eq("slug", slug)
    .eq("category", category)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("LOAD SUBJECT LANDING ERROR:", error);
    return null;
  }

  if (
    !data ||
    !isSubjectType(data.type) ||
    !isSubjectLandingCategory(data.category)
  ) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    type: data.type,
    category: data.category,
    name_ko: data.name_ko,
    name_en: data.name_en,
    name_zh_tw: data.name_zh_tw,
  };
}

export async function countEligibleSubjectWorks(
  supabase: SupabaseClient,
  subjectId: string,
  category: CreatorCategory,
): Promise<number> {
  const { data, error } = await supabase
    .from("work_subjects")
    .select("work_id")
    .eq("subject_id", subjectId)
    .limit(SUBJECT_WORK_ID_LIMIT);

  if (error) {
    console.error("COUNT SUBJECT LANDING WORKS ERROR:", error);
    return 0;
  }

  const workIds = uniquePositiveIds(
    (data ?? []).map((row) => row.work_id),
  );

  if (workIds.length === 0) {
    return 0;
  }

  const { count, error: countError } = await supabase
    .from("discover_works_effective")
    .select("id", { count: "exact", head: true })
    .in("id", workIds)
    .eq("featured", false)
    .eq("discover_eligible", true)
    .eq("effective_category", category);

  if (countError) {
    console.error("COUNT SUBJECT LANDING ELIGIBLE WORKS ERROR:", countError);
    return 0;
  }

  return count ?? 0;
}

export async function loadSubjectGroupDisplayName(
  supabase: SupabaseClient,
  subject: SubjectLandingRecord,
  locale: SubjectLandingLocale,
): Promise<string | null> {
  if (subject.type !== "person" || subject.category !== "kpop") {
    return null;
  }

  const { data, error } = await supabase
    .from("subject_group_memberships")
    .select("group_subject_id")
    .eq("person_subject_id", subject.id)
    .eq("active", true);

  if (error) {
    console.error("LOAD SUBJECT GROUP NAME ERROR:", error);
    return null;
  }

  const groupIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.group_subject_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  if (groupIds.length !== 1) {
    return null;
  }

  const { data: group, error: groupError } = await supabase
    .from("subjects")
    .select("name_ko, name_en, name_zh_tw, active")
    .eq("id", groupIds[0])
    .eq("active", true)
    .maybeSingle();

  if (groupError) {
    console.error("LOAD SUBJECT GROUP NAME ERROR:", groupError);
    return null;
  }

  if (!group) {
    return null;
  }

  const name = resolveSubjectDisplayName(locale, {
    name_ko: group.name_ko,
    name_en: group.name_en,
    name_zh_tw: group.name_zh_tw,
  });

  return name || null;
}

export type SubjectLandingPageData = {
  subject: SubjectLandingRecord;
  displayName: string;
  heading: string;
  metadata: Metadata;
  locale: SubjectLandingLocale;
};

export async function loadSubjectLandingPageData(
  supabase: SupabaseClient,
  category: SubjectLandingCategory,
  slug: string,
  locale: SubjectLandingLocale,
): Promise<SubjectLandingPageData | null> {
  const subject = await loadSubjectLandingRecord(
    supabase,
    category,
    slug,
  );

  if (!subject) {
    return null;
  }

  const displayName = resolveSubjectDisplayName(
    locale,
    subject,
  );

  if (!displayName) {
    return null;
  }

  const [workCount, groupName] = await Promise.all([
    countEligibleSubjectWorks(
      supabase,
      subject.id,
      subject.category,
    ),
    loadSubjectGroupDisplayName(supabase, subject, locale),
  ]);

  const copy = buildSubjectLandingCopy({
    locale,
    category: subject.category,
    type: subject.type,
    name: displayName,
    groupName:
      subject.type === "person" ? groupName : null,
  });

  return {
    subject,
    displayName,
    heading: copy.h1,
    locale,
    metadata: buildSubjectLandingMetadata({
      locale,
      category: subject.category,
      slug: subject.slug,
      title: copy.title,
      description: copy.description,
      indexable: shouldIndexSubjectLanding(workCount),
    }),
  };
}

export async function loadIndexableSubjectLandingEntries(
  supabase: SupabaseClient,
): Promise<
  Array<{
    slug: string;
    category: SubjectLandingCategory;
  }>
> {
  const { data: subjects, error } = await supabase
    .from("subjects")
    .select("id, slug, category, type, active")
    .eq("active", true)
    .in("category", [...SUBJECT_LANDING_CATEGORIES]);

  if (error) {
    console.error("LOAD SUBJECT SITEMAP SUBJECTS ERROR:", error);
    return [];
  }

  const usable = (subjects ?? []).filter(
    (row): row is {
      id: string;
      slug: string;
      category: SubjectLandingCategory;
      type: string;
      active: boolean;
    } =>
      typeof row.id === "string" &&
      typeof row.slug === "string" &&
      isSubjectLandingCategory(row.category) &&
      isSubjectCategory(row.category),
  );

  if (usable.length === 0) {
    return [];
  }

  const { data: links, error: linkError } = await supabase
    .from("work_subjects")
    .select("work_id, subject_id")
    .in(
      "subject_id",
      usable.map((subject) => subject.id),
    )
    .limit(SUBJECT_WORK_ID_LIMIT * 4);

  if (linkError) {
    console.error("LOAD SUBJECT SITEMAP LINKS ERROR:", linkError);
    return [];
  }

  const workIdsBySubject = new Map<string, Set<number>>();

  for (const row of links ?? []) {
    const workId = Number(row.work_id);

    if (!Number.isInteger(workId) || workId <= 0) {
      continue;
    }

    const current = workIdsBySubject.get(row.subject_id);

    if (current) {
      current.add(workId);
    } else {
      workIdsBySubject.set(row.subject_id, new Set([workId]));
    }
  }

  const allWorkIds = [
    ...new Set(
      [...workIdsBySubject.values()].flatMap((ids) => [...ids]),
    ),
  ];

  const eligibleWorkIds = new Set<number>();

  for (let index = 0; index < allWorkIds.length; index += 400) {
    const chunk = allWorkIds.slice(index, index + 400);
    const { data: eligibleRows, error: eligibleError } = await supabase
      .from("discover_works_effective")
      .select("id")
      .in("id", chunk)
      .eq("featured", false)
      .eq("discover_eligible", true);

    if (eligibleError) {
      console.error(
        "LOAD SUBJECT SITEMAP ELIGIBLE WORKS ERROR:",
        eligibleError,
      );
      continue;
    }

    for (const row of eligibleRows ?? []) {
      const workId = Number(row.id);

      if (Number.isInteger(workId) && workId > 0) {
        eligibleWorkIds.add(workId);
      }
    }
  }

  return usable.flatMap((subject) => {
    const linked = workIdsBySubject.get(subject.id);

    if (!linked) {
      return [];
    }

    let eligibleCount = 0;

    for (const workId of linked) {
      if (eligibleWorkIds.has(workId)) {
        eligibleCount += 1;
      }
    }

    if (eligibleCount < SUBJECT_LANDING_MIN_WORKS) {
      return [];
    }

    return [
      {
        slug: subject.slug,
        category: subject.category,
      },
    ];
  });
}
