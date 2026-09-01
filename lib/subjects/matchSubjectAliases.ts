import { isUsableAlias, matchesByMode } from "@/lib/subjects/matchAliasUtils";
import {
  indexGroupMemberships,
  matchKpopWork,
} from "@/lib/subjects/matchKpopSubjects";
import {
  SUBJECT_MATCH_CONFIDENCE,
  type AutoWorkSubjectSource,
  type SubjectAliasRow,
  type SubjectCategory,
  type SubjectGroupMembership,
  type SubjectType,
  type WorkSubjectMatch,
} from "@/lib/subjects/subjectTypes";

export type ClassifiableWork = {
  id: number;
  title: string | null;
  description: string | null;
  artistName: string | null;
  effectiveCategory: string | null;
};

export type MatcherSubject = {
  id: string;
  type: SubjectType;
  category: SubjectCategory;
  active: boolean;
  aliases: Array<
    Pick<
      SubjectAliasRow,
      | "alias"
      | "normalized_alias"
      | "match_mode"
      | "auto_match_enabled"
    >
  >;
};

export type AliasSkipReason = {
  category: SubjectCategory;
  normalizedAlias: string;
  subjectIds: string[];
};

export type MatchWorksResult = {
  matches: WorkSubjectMatch[];
  skippedAmbiguousAliases: AliasSkipReason[];
  matchedWorkIds: number[];
  unmatchedWorkIds: number[];
  matchCountBySubjectId: Record<string, number>;
};

const AUTO_SOURCES_BY_FIELD: Record<
  "title" | "description",
  AutoWorkSubjectSource
> = {
  title: "auto_title",
  description: "auto_description",
};

export function findAmbiguousAliases(
  subjects: MatcherSubject[],
): AliasSkipReason[] {
  const groups = new Map<
    string,
    { category: SubjectCategory; subjectIds: Set<string> }
  >();

  for (const subject of subjects) {
    if (!subject.active) {
      continue;
    }

    for (const alias of subject.aliases) {
      if (!isUsableAlias(alias)) {
        continue;
      }

      const key = `${subject.category}:${alias.normalized_alias}`;
      const current = groups.get(key);

      if (current) {
        current.subjectIds.add(subject.id);
      } else {
        groups.set(key, {
          category: subject.category,
          subjectIds: new Set([subject.id]),
        });
      }
    }
  }

  const skipped: AliasSkipReason[] = [];

  for (const [key, group] of groups) {
    if (group.subjectIds.size < 2) {
      continue;
    }

    skipped.push({
      category: group.category,
      normalizedAlias: key.slice(key.indexOf(":") + 1),
      subjectIds: [...group.subjectIds],
    });
  }

  return skipped;
}

function matchField(
  work: ClassifiableWork,
  subjects: MatcherSubject[],
  ambiguousKeys: Set<string>,
  category: SubjectCategory,
  field: "title" | "description",
): WorkSubjectMatch[] {
  const source = AUTO_SOURCES_BY_FIELD[field];
  const text =
    field === "title" ? (work.title ?? "") : (work.description ?? "");
  const bestBySubject = new Map<string, WorkSubjectMatch>();

  for (const subject of subjects) {
    if (!subject.active || subject.category !== category) {
      continue;
    }

    for (const alias of subject.aliases) {
      if (!isUsableAlias(alias)) {
        continue;
      }

      const ambiguousKey = `${subject.category}:${alias.normalized_alias}`;

      if (ambiguousKeys.has(ambiguousKey)) {
        continue;
      }

      if (
        !matchesByMode(text, alias.normalized_alias, alias.match_mode)
      ) {
        continue;
      }

      const next: WorkSubjectMatch = {
        workId: work.id,
        subjectId: subject.id,
        source,
        matchedAlias: alias.alias,
        confidence: SUBJECT_MATCH_CONFIDENCE[source],
      };

      const current = bestBySubject.get(subject.id);

      if (!current || next.confidence > current.confidence) {
        bestBySubject.set(subject.id, next);
      }
    }
  }

  return [...bestBySubject.values()];
}

function matchWork(
  work: ClassifiableWork,
  subjects: MatcherSubject[],
  ambiguousKeys: Set<string>,
): WorkSubjectMatch[] {
  const category = work.effectiveCategory?.trim().toLowerCase();

  if (category !== "cheer" && category !== "look") {
    return [];
  }

  const titleMatches = matchField(
    work,
    subjects,
    ambiguousKeys,
    category,
    "title",
  );

  if (titleMatches.length > 0) {
    return titleMatches;
  }

  return matchField(
    work,
    subjects,
    ambiguousKeys,
    category,
    "description",
  );
}

export function matchWorksToSubjects(
  works: ClassifiableWork[],
  subjects: MatcherSubject[],
  memberships: SubjectGroupMembership[] = [],
): MatchWorksResult {
  const skippedAmbiguousAliases = findAmbiguousAliases(
    subjects.filter(
      (subject) => subject.category !== "kpop" || subject.type === "group",
    ),
  );
  const ambiguousKeys = new Set(
    skippedAmbiguousAliases.map(
      (item) => `${item.category}:${item.normalizedAlias}`,
    ),
  );
  const personToGroups = indexGroupMemberships(memberships);
  const skippedPersonKeys = new Set<string>();

  const matches: WorkSubjectMatch[] = [];
  const matchedWorkIds: number[] = [];
  const unmatchedWorkIds: number[] = [];
  const matchCountBySubjectId: Record<string, number> = {};

  for (const work of works) {
    const category = work.effectiveCategory?.trim().toLowerCase();
    let workMatches: WorkSubjectMatch[] = [];

    if (category === "kpop") {
      const titleResult = matchKpopWork(
        work,
        subjects,
        personToGroups,
        ambiguousKeys,
        "title",
      );
      const descriptionResult =
        titleResult.matches.length > 0
          ? null
          : matchKpopWork(
              work,
              subjects,
              personToGroups,
              ambiguousKeys,
              "description",
            );
      const kpopResult = descriptionResult ?? titleResult;

      workMatches = kpopResult.matches;

      for (const skipped of [
        ...titleResult.skippedPersonAliases,
        ...(descriptionResult?.skippedPersonAliases ?? []),
      ]) {
        const key = `${skipped.category}:${skipped.normalizedAlias}`;

        if (skippedPersonKeys.has(key)) {
          continue;
        }

        skippedPersonKeys.add(key);
        skippedAmbiguousAliases.push(skipped);
      }
    } else {
      workMatches = matchWork(work, subjects, ambiguousKeys);
    }

    if (workMatches.length === 0) {
      unmatchedWorkIds.push(work.id);
      continue;
    }

    matchedWorkIds.push(work.id);
    matches.push(...workMatches);

    for (const match of workMatches) {
      matchCountBySubjectId[match.subjectId] =
        (matchCountBySubjectId[match.subjectId] ?? 0) + 1;
    }
  }

  return {
    matches,
    skippedAmbiguousAliases,
    matchedWorkIds,
    unmatchedWorkIds,
    matchCountBySubjectId,
  };
}
