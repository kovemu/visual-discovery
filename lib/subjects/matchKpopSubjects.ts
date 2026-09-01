import { isUsableAlias, matchesByMode } from "@/lib/subjects/matchAliasUtils";
import type {
  AliasSkipReason,
  ClassifiableWork,
  MatcherSubject,
} from "@/lib/subjects/matchSubjectAliases";
import {
  SUBJECT_MATCH_CONFIDENCE,
  type AutoWorkSubjectSource,
  type SubjectGroupMembership,
  type WorkSubjectMatch,
} from "@/lib/subjects/subjectTypes";

type AliasHit = {
  subjectId: string;
  alias: string;
  normalizedAlias: string;
};

export function extractHashtagText(text: string): string {
  if (!text) {
    return "";
  }

  const tags: string[] = [];
  const pattern = /#([^\s#]+)/gu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match[1]) {
      tags.push(match[1]);
    }
  }

  return tags.join(" ");
}

export function indexGroupMemberships(
  memberships: SubjectGroupMembership[],
) {
  const personToGroups = new Map<string, Set<string>>();

  for (const membership of memberships) {
    if (!membership.active) {
      continue;
    }

    const groups = personToGroups.get(membership.personSubjectId);

    if (groups) {
      groups.add(membership.groupSubjectId);
    } else {
      personToGroups.set(
        membership.personSubjectId,
        new Set([membership.groupSubjectId]),
      );
    }
  }

  return personToGroups;
}

function collectHits(
  text: string,
  subjects: MatcherSubject[],
  type: "person" | "group",
  ambiguousKeys?: Set<string>,
): AliasHit[] {
  if (!text) {
    return [];
  }

  const hits: AliasHit[] = [];

  for (const subject of subjects) {
    if (
      !subject.active ||
      subject.category !== "kpop" ||
      subject.type !== type
    ) {
      continue;
    }

    for (const alias of subject.aliases) {
      if (!isUsableAlias(alias)) {
        continue;
      }

      if (
        ambiguousKeys?.has(`${subject.category}:${alias.normalized_alias}`)
      ) {
        continue;
      }

      if (
        !matchesByMode(text, alias.normalized_alias, alias.match_mode)
      ) {
        continue;
      }

      hits.push({
        subjectId: subject.id,
        alias: alias.alias,
        normalizedAlias: alias.normalized_alias,
      });
    }
  }

  return hits;
}

function uniqueGroupMatches(
  workId: number,
  hits: AliasHit[],
  source: AutoWorkSubjectSource,
): WorkSubjectMatch[] {
  const bestBySubject = new Map<string, WorkSubjectMatch>();

  for (const hit of hits) {
    const next: WorkSubjectMatch = {
      workId,
      subjectId: hit.subjectId,
      source,
      matchedAlias: hit.alias,
      confidence: SUBJECT_MATCH_CONFIDENCE[source],
    };
    const current = bestBySubject.get(hit.subjectId);

    if (!current) {
      bestBySubject.set(hit.subjectId, next);
    }
  }

  return [...bestBySubject.values()];
}

function resolvePersonHits(
  workId: number,
  hits: AliasHit[],
  matchedGroupIds: Set<string>,
  personToGroups: Map<string, Set<string>>,
  source: AutoWorkSubjectSource,
): {
  matches: WorkSubjectMatch[];
  skipped: AliasSkipReason[];
} {
  const byAlias = new Map<string, AliasHit[]>();

  for (const hit of hits) {
    const current = byAlias.get(hit.normalizedAlias);

    if (current) {
      current.push(hit);
    } else {
      byAlias.set(hit.normalizedAlias, [hit]);
    }
  }

  const matches = new Map<string, WorkSubjectMatch>();
  const skipped: AliasSkipReason[] = [];

  for (const [normalizedAlias, aliasHits] of byAlias) {
    const subjectIds = [...new Set(aliasHits.map((hit) => hit.subjectId))];
    let resolvedIds = subjectIds;

    if (subjectIds.length > 1) {
      const narrowed = subjectIds.filter((subjectId) => {
        const groups = personToGroups.get(subjectId);

        if (!groups || matchedGroupIds.size === 0) {
          return false;
        }

        for (const groupId of matchedGroupIds) {
          if (groups.has(groupId)) {
            return true;
          }
        }

        return false;
      });

      resolvedIds = narrowed.length === 1 ? narrowed : [];

      if (resolvedIds.length === 0) {
        skipped.push({
          category: "kpop",
          normalizedAlias,
          subjectIds,
        });
        continue;
      }
    }

    for (const subjectId of resolvedIds) {
      const hit = aliasHits.find((item) => item.subjectId === subjectId);

      if (!hit || matches.has(subjectId)) {
        continue;
      }

      matches.set(subjectId, {
        workId,
        subjectId,
        source,
        matchedAlias: hit.alias,
        confidence: SUBJECT_MATCH_CONFIDENCE[source],
      });
    }
  }

  return {
    matches: [...matches.values()],
    skipped,
  };
}

function personIsMemberOfGroup(
  personSubjectId: string,
  groupSubjectId: string,
  personToGroups: Map<string, Set<string>>,
) {
  return personToGroups.get(personSubjectId)?.has(groupSubjectId) === true;
}

export function matchKpopWork(
  work: ClassifiableWork,
  subjects: MatcherSubject[],
  personToGroups: Map<string, Set<string>>,
  ambiguousGroupKeys: Set<string>,
  field: "title" | "description",
): {
  matches: WorkSubjectMatch[];
  skippedPersonAliases: AliasSkipReason[];
} {
  const source: AutoWorkSubjectSource =
    field === "title" ? "auto_title" : "auto_description";
  const text =
    field === "title" ? (work.title ?? "") : (work.description ?? "");

  const groupMatches = uniqueGroupMatches(
    work.id,
    collectHits(text, subjects, "group", ambiguousGroupKeys),
    source,
  );
  const matchedGroupIds = new Set(
    groupMatches.map((match) => match.subjectId),
  );

  const hashtagText = extractHashtagText(text);
  const hashtagPersonHits = collectHits(hashtagText, subjects, "person");
  const personHits =
    hashtagPersonHits.length > 0
      ? hashtagPersonHits
      : collectHits(text, subjects, "person");

  const resolvedPersons = resolvePersonHits(
    work.id,
    personHits,
    matchedGroupIds,
    personToGroups,
    source,
  );

  const validatedGroups =
    resolvedPersons.matches.length > 0
      ? groupMatches.filter((group) =>
          resolvedPersons.matches.some((person) =>
            personIsMemberOfGroup(
              person.subjectId,
              group.subjectId,
              personToGroups,
            ),
          ),
        )
      : groupMatches;

  const matches = [...resolvedPersons.matches, ...validatedGroups];

  return {
    matches,
    skippedPersonAliases: resolvedPersons.skipped,
  };
}
