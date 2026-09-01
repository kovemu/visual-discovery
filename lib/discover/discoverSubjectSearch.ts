import type { SupabaseClient } from "@supabase/supabase-js";

import {
  compactSubjectText,
  normalizeSubjectAlias,
} from "@/lib/subjects/normalizeSubjectText";
import type { CreatorCategory } from "@/lib/creator/creatorCategories";

export type DiscoverSubjectSearchResult = {
  exactWorkIds: number[];
  partialWorkIds: number[];
  subjectMatchCount: number;
};

export type SubjectAliasMatchRow = {
  subject_id: string;
  normalized_alias: string;
  subjects:
    | {
        id: string;
        category: string;
        active: boolean;
      }
    | {
        id: string;
        category: string;
        active: boolean;
      }[]
    | null;
};

const MAX_SUBJECT_IDS = 500;
const MAX_SUBJECT_WORK_IDS = 2000;

function escapePostgrestIlikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/_/g, "\\_");
}

function subjectRowCategory(
  row: SubjectAliasMatchRow,
): string | null {
  const subject = Array.isArray(row.subjects)
    ? row.subjects[0]
    : row.subjects;

  return subject?.active ? subject.category : null;
}

function subjectMatchesCategories(
  row: SubjectAliasMatchRow,
  categories: CreatorCategory[] | null,
): boolean {
  if (!categories || categories.length === 0) {
    return true;
  }

  const category = subjectRowCategory(row);

  return category
    ? categories.includes(category as CreatorCategory)
    : false;
}

export function buildDiscoverSubjectCompactQuery(
  normalizedSearch: string,
): string {
  return compactSubjectText(normalizedSearch);
}

export function discoverSubjectCompactVariants(
  normalizedSearch: string,
): string[] {
  const base = buildDiscoverSubjectCompactQuery(
    normalizedSearch,
  );
  const variants = new Set<string>([
    base,
    base.replace(/\s+/g, ""),
    base.replace(/[-\s_]+/g, ""),
  ]);

  return [...variants].filter(
    (value) => value.length >= 2,
  );
}

function buildExactSubjectAliasFilters(
  normalizedSearch: string,
): string[] {
  const compactQuery =
    buildDiscoverSubjectCompactQuery(normalizedSearch);
  const filters = new Set<string>([
    `normalized_alias.eq.${compactQuery}`,
  ]);

  for (const variant of discoverSubjectCompactVariants(
    normalizedSearch,
  )) {
    filters.add(`normalized_alias.eq.${variant}`);
  }

  const aliasCandidates = new Set([
    normalizedSearch,
    normalizedSearch.replace(/\s+/g, "-"),
    normalizedSearch.replace(/-/g, " "),
  ]);

  for (const alias of aliasCandidates) {
    if (alias.length < 2) {
      continue;
    }

    filters.add(
      `alias.ilike."${escapePostgrestIlikePattern(alias)}"`,
    );
  }

  return [...filters];
}

export function mergeDiscoverSearchWorkIds(input: {
  exactWorkIds: readonly number[];
  partialWorkIds: readonly number[];
}): number[] {
  const seen = new Set<number>();
  const merged: number[] = [];

  for (const workId of [
    ...input.exactWorkIds,
    ...input.partialWorkIds,
  ]) {
    if (seen.has(workId)) {
      continue;
    }

    seen.add(workId);
    merged.push(workId);
  }

  return merged;
}

export function sliceDiscoverSearchPriorityPage(
  priorityWorkIds: readonly number[],
  from: number,
  batchSize: number,
): {
  prioritySlice: number[];
  metadataFrom: number;
  metadataLimit: number;
} {
  const safeFrom = Math.max(0, from);
  const prioritySlice = priorityWorkIds.slice(
    safeFrom,
    safeFrom + batchSize,
  );

  return {
    prioritySlice,
    metadataFrom: Math.max(
      0,
      safeFrom - priorityWorkIds.length,
    ),
    metadataLimit: Math.max(
      0,
      batchSize - prioritySlice.length,
    ),
  };
}

export async function resolveDiscoverSubjectSearch(
  supabase: SupabaseClient,
  normalizedSearch: string,
  tokens: readonly string[],
  categories: CreatorCategory[] | null,
): Promise<DiscoverSubjectSearchResult> {
  const compactQuery =
    buildDiscoverSubjectCompactQuery(normalizedSearch);
  const exactSubjectIds = new Set<string>();
  const partialSubjectIds = new Set<string>();

  if (compactQuery.length >= 2) {
    const { data, error } = await supabase
      .from("subject_aliases")
      .select(
        `
          subject_id,
          normalized_alias,
          alias,
          subjects!inner (
            id,
            category,
            active
          )
        `,
      )
      .eq("subjects.active", true)
      .or(
        buildExactSubjectAliasFilters(normalizedSearch).join(
          ",",
        ),
      )
      .limit(MAX_SUBJECT_IDS);

    if (error) {
      console.log("DISCOVER SUBJECT EXACT SEARCH ERROR:", {
        compactQuery,
        code: error.code,
        message: error.message,
      });
    } else {
      for (const row of (data ?? []) as SubjectAliasMatchRow[]) {
        if (!subjectMatchesCategories(row, categories)) {
          continue;
        }

        exactSubjectIds.add(row.subject_id);
      }
    }
  }

  const partialTokens = Array.from(
    new Set(
      tokens
        .map((token) => compactSubjectText(token))
        .filter((token) => token.length >= 2),
    ),
  );

  if (partialTokens.length > 0) {
    const partialFilters = partialTokens.flatMap((token) => {
      const pattern = `"*${escapePostgrestIlikePattern(token)}*"`;

      return [
        `normalized_alias.ilike.${pattern}`,
        `alias.ilike.${pattern}`,
      ];
    });

    const { data, error } = await supabase
      .from("subject_aliases")
      .select(
        `
          subject_id,
          normalized_alias,
          alias,
          subjects!inner (
            id,
            category,
            active
          )
        `,
      )
      .eq("subjects.active", true)
      .or(partialFilters.join(","))
      .limit(MAX_SUBJECT_IDS);

    if (error) {
      console.log("DISCOVER SUBJECT PARTIAL SEARCH ERROR:", {
        tokens: partialTokens,
        code: error.code,
        message: error.message,
      });
    } else {
      for (const row of (data ?? []) as Array<
        SubjectAliasMatchRow & { alias?: string }
      >) {
        if (!subjectMatchesCategories(row, categories)) {
          continue;
        }

        const normalizedAlias = row.normalized_alias;
        const isExactAlias =
          normalizedAlias === compactQuery ||
          normalizeSubjectAlias(normalizedAlias) ===
            compactQuery ||
          normalizeSubjectAlias(row.alias ?? "") ===
            compactQuery;

        if (isExactAlias) {
          exactSubjectIds.add(row.subject_id);
        } else {
          partialSubjectIds.add(row.subject_id);
        }
      }
    }
  }

  for (const subjectId of exactSubjectIds) {
    partialSubjectIds.delete(subjectId);
  }

  const exactSubjectIdSet = exactSubjectIds;
  const partialSubjectIdSet = partialSubjectIds;
  const allSubjectIds = [
    ...exactSubjectIdSet,
    ...partialSubjectIdSet,
  ];
  const workIdsBySubject = await loadWorkIdsBySubjects(
    supabase,
    allSubjectIds,
  );

  const exactWorkIds: number[] = [];
  const partialWorkIds: number[] = [];
  const exactWorkIdSet = new Set<number>();
  const partialWorkIdSet = new Set<number>();

  for (const [subjectId, workIds] of workIdsBySubject) {
    for (const workId of workIds) {
      if (exactSubjectIdSet.has(subjectId)) {
        if (!exactWorkIdSet.has(workId)) {
          exactWorkIdSet.add(workId);
          exactWorkIds.push(workId);
        }
        continue;
      }

      if (
        !exactWorkIdSet.has(workId) &&
        !partialWorkIdSet.has(workId)
      ) {
        partialWorkIdSet.add(workId);
        partialWorkIds.push(workId);
      }
    }
  }

  return {
    exactWorkIds,
    partialWorkIds,
    subjectMatchCount:
      exactSubjectIds.size + partialSubjectIds.size,
  };
}

async function loadWorkIdsBySubjects(
  supabase: SupabaseClient,
  subjectIds: readonly string[],
): Promise<Map<string, number[]>> {
  const grouped = new Map<string, number[]>();

  if (subjectIds.length === 0) {
    return grouped;
  }

  const { data, error } = await supabase
    .from("work_subjects")
    .select("work_id, subject_id")
    .in("subject_id", [...subjectIds])
    .limit(MAX_SUBJECT_WORK_IDS);

  if (error) {
    console.log("DISCOVER SUBJECT WORK LOOKUP ERROR:", {
      subjectCount: subjectIds.length,
      code: error.code,
      message: error.message,
    });
    return grouped;
  }

  for (const row of data ?? []) {
    const workId = Number(row.work_id);
    const subjectId = String(row.subject_id);

    if (
      !Number.isInteger(workId) ||
      workId <= 0
    ) {
      continue;
    }

    const current = grouped.get(subjectId);

    if (current) {
      current.push(workId);
    } else {
      grouped.set(subjectId, [workId]);
    }
  }

  return grouped;
}
