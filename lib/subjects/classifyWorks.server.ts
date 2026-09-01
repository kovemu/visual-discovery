import type { SupabaseClient } from "@supabase/supabase-js";

import {
  matchWorksToSubjects,
  type ClassifiableWork,
  type MatcherSubject,
} from "@/lib/subjects/matchSubjectAliases";
import {
  AUTO_WORK_SUBJECT_SOURCES,
  isSubjectCategory,
  isSubjectGroupRelationType,
  isSubjectMatchMode,
  isSubjectType,
  type SubjectAliasRow,
  type SubjectCategory,
  type SubjectGroupMembership,
  type WorkSubjectMatch,
} from "@/lib/subjects/subjectTypes";

const WORK_ID_CHUNK_SIZE = 400;

type EffectiveWorkRow = {
  id: number | string;
  title: string | null;
  description: string | null;
  artist_name: string | null;
  effective_category: string | null;
};

type SubjectQueryRow = {
  id: string;
  type: string;
  category: string;
  active: boolean;
  subject_aliases:
    | Array<{
        alias: string;
        normalized_alias: string;
        match_mode: string;
        auto_match_enabled: boolean;
      }>
    | null;
};

function asWorkId(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function uniqueWorkIds(
  values: Array<number | string | null | undefined>,
): number[] {
  const ids = new Set<number>();

  for (const value of values) {
    const id = asWorkId(value);

    if (id !== null) {
      ids.add(id);
    }
  }

  return [...ids];
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function mapEffectiveWork(row: EffectiveWorkRow): ClassifiableWork | null {
  const id = asWorkId(row.id);

  if (id === null) {
    return null;
  }

  return {
    id,
    title: row.title,
    description: row.description,
    artistName: row.artist_name,
    effectiveCategory: row.effective_category,
  };
}

function mapSubjectRow(row: SubjectQueryRow): MatcherSubject | null {
  if (!isSubjectType(row.type) || !isSubjectCategory(row.category)) {
    return null;
  }

  return {
    id: row.id,
    type: row.type,
    category: row.category,
    active: row.active,
    aliases: (row.subject_aliases ?? [])
      .filter(
        (
          alias,
        ): alias is {
          alias: string;
          normalized_alias: string;
          match_mode: SubjectAliasRow["match_mode"];
          auto_match_enabled: boolean;
        } =>
          typeof alias.alias === "string" &&
          typeof alias.normalized_alias === "string" &&
          isSubjectMatchMode(alias.match_mode),
      )
      .map((alias) => ({
        alias: alias.alias,
        normalized_alias: alias.normalized_alias,
        match_mode: alias.match_mode,
        auto_match_enabled: alias.auto_match_enabled !== false,
      })),
  };
}

export async function loadMatcherSubjects(
  supabase: SupabaseClient,
  categories?: SubjectCategory[],
) {
  let query = supabase
    .from("subjects")
    .select(
      `
        id,
        type,
        category,
        active,
        subject_aliases (
          alias,
          normalized_alias,
          match_mode,
          auto_match_enabled
        )
      `,
    )
    .eq("active", true);

  if (categories && categories.length > 0) {
    query = query.in("category", categories);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as SubjectQueryRow[])
    .map(mapSubjectRow)
    .filter((subject): subject is MatcherSubject => subject !== null);
}

export async function loadGroupMemberships(
  supabase: SupabaseClient,
): Promise<SubjectGroupMembership[]> {
  const { data, error } = await supabase
    .from("subject_group_memberships")
    .select("person_subject_id, group_subject_id, relation_type, active")
    .eq("active", true);

  if (error) {
    throw error;
  }

  return (data ?? []).flatMap((row) => {
    if (!isSubjectGroupRelationType(row.relation_type)) {
      return [];
    }

    return [
      {
        personSubjectId: row.person_subject_id as string,
        groupSubjectId: row.group_subject_id as string,
        relationType: row.relation_type,
        active: row.active !== false,
      },
    ];
  });
}

async function loadClassifiableWorks(
  supabase: SupabaseClient,
  workIds: number[],
) {
  const works: ClassifiableWork[] = [];

  for (const chunk of chunkValues(workIds, WORK_ID_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("discover_works_effective")
      .select("id, title, description, artist_name, effective_category")
      .in("id", chunk);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as EffectiveWorkRow[]) {
      const work = mapEffectiveWork(row);

      if (work) {
        works.push(work);
      }
    }
  }

  return works;
}

async function replaceAutoWorkSubjects(
  supabase: SupabaseClient,
  workIds: number[],
  matches: WorkSubjectMatch[],
) {
  for (const chunk of chunkValues(workIds, WORK_ID_CHUNK_SIZE)) {
    const { data: manualRows, error: manualError } = await supabase
      .from("work_subjects")
      .select("work_id, subject_id")
      .in("work_id", chunk)
      .eq("source", "manual");

    if (manualError) {
      throw manualError;
    }

    const manualKeys = new Set(
      (manualRows ?? []).map(
        (row) => `${row.work_id}:${row.subject_id}`,
      ),
    );

    const { error: deleteError } = await supabase
      .from("work_subjects")
      .delete()
      .in("work_id", chunk)
      .in("source", [...AUTO_WORK_SUBJECT_SOURCES]);

    if (deleteError) {
      throw deleteError;
    }

    const rows = matches
      .filter((match) => chunk.includes(match.workId))
      .filter(
        (match) => !manualKeys.has(`${match.workId}:${match.subjectId}`),
      )
      .map((match) => ({
        work_id: match.workId,
        subject_id: match.subjectId,
        source: match.source,
        matched_alias: match.matchedAlias,
        confidence: match.confidence,
        updated_at: new Date().toISOString(),
      }));

    if (rows.length === 0) {
      continue;
    }

    const { error: insertError } = await supabase
      .from("work_subjects")
      .upsert(rows, {
        onConflict: "work_id,subject_id",
        ignoreDuplicates: true,
      });

    if (insertError) {
      throw insertError;
    }
  }
}

export async function classifyWorksSubjects(
  supabase: SupabaseClient,
  workIdsInput: Array<number | string | null | undefined>,
) {
  const workIds = uniqueWorkIds(workIdsInput);

  if (workIds.length === 0) {
    return {
      workCount: 0,
      matchCount: 0,
      matchedWorkIds: [] as number[],
      unmatchedWorkIds: [] as number[],
      skippedAmbiguousAliases: [],
      matchCountBySubjectId: {} as Record<string, number>,
    };
  }

  const works = await loadClassifiableWorks(supabase, workIds);
  const categories = [
    ...new Set(
      works
        .map((work) => work.effectiveCategory)
        .filter(isSubjectCategory),
    ),
  ];
  const subjects = await loadMatcherSubjects(supabase, categories);
  const memberships = categories.includes("kpop")
    ? await loadGroupMemberships(supabase)
    : [];
  const result = matchWorksToSubjects(works, subjects, memberships);

  await replaceAutoWorkSubjects(supabase, workIds, result.matches);

  return {
    workCount: works.length,
    matchCount: result.matches.length,
    matchedWorkIds: result.matchedWorkIds,
    unmatchedWorkIds: result.unmatchedWorkIds,
    skippedAmbiguousAliases: result.skippedAmbiguousAliases,
    matchCountBySubjectId: result.matchCountBySubjectId,
  };
}

export async function classifyWorkSubjects(
  supabase: SupabaseClient,
  workId: number | string,
) {
  return classifyWorksSubjects(supabase, [workId]);
}

export async function classifyWorksSubjectsSafe(
  supabase: SupabaseClient,
  workIds: Array<number | string | null | undefined>,
) {
  try {
    return await classifyWorksSubjects(supabase, workIds);
  } catch (error) {
    console.error("CLASSIFY WORK SUBJECTS ERROR:", error);
    return null;
  }
}

export async function previewWorkSubjectMatches(
  supabase: SupabaseClient,
  works: ClassifiableWork[],
) {
  const categories = [
    ...new Set(
      works
        .map((work) => work.effectiveCategory)
        .filter(isSubjectCategory),
    ),
  ];
  const subjects = await loadMatcherSubjects(supabase, categories);
  const memberships = categories.includes("kpop")
    ? await loadGroupMemberships(supabase)
    : [];
  return matchWorksToSubjects(works, subjects, memberships);
}

export async function loadClassifiableWorksByCategory(
  supabase: SupabaseClient,
  category: SubjectCategory,
  options: {
    from: number;
    to: number;
  },
) {
  const { data, error } = await supabase
    .from("discover_works_effective")
    .select("id, title, description, artist_name, effective_category")
    .eq("effective_category", category)
    .order("id", { ascending: true })
    .range(options.from, options.to);

  if (error) {
    throw error;
  }

  return ((data ?? []) as EffectiveWorkRow[])
    .map(mapEffectiveWork)
    .filter((work): work is ClassifiableWork => work !== null);
}
