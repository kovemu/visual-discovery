export const SUBJECT_TYPES = ["person", "group"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const SUBJECT_GROUP_RELATION_TYPES = ["current", "former"] as const;
export type SubjectGroupRelationType =
  (typeof SUBJECT_GROUP_RELATION_TYPES)[number];

export const SUBJECT_CATEGORIES = ["cheer", "kpop", "look"] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

export const SUBJECT_MATCH_MODES = ["substring", "token"] as const;
export type SubjectMatchMode = (typeof SUBJECT_MATCH_MODES)[number];

export const SUBJECT_LANGUAGES = ["ko", "en", "zh-TW"] as const;
export type SubjectLanguage = (typeof SUBJECT_LANGUAGES)[number];

export const WORK_SUBJECT_SOURCES = [
  "manual",
  "auto_title",
  "auto_description",
  "auto_creator",
] as const;
export type WorkSubjectSource = (typeof WORK_SUBJECT_SOURCES)[number];

export const AUTO_WORK_SUBJECT_SOURCES = [
  "auto_title",
  "auto_description",
  "auto_creator",
] as const;
export type AutoWorkSubjectSource =
  (typeof AUTO_WORK_SUBJECT_SOURCES)[number];

export const SUBJECT_MATCH_CONFIDENCE = {
  auto_title: 1,
  auto_description: 0.95,
  auto_creator: 0.9,
} as const;

export type SubjectRow = {
  id: string;
  type: SubjectType;
  category: SubjectCategory;
  slug: string;
  name_ko: string | null;
  name_en: string | null;
  name_zh_tw: string | null;
  active: boolean;
};

export type SubjectAliasRow = {
  id: number;
  subject_id: string;
  alias: string;
  normalized_alias: string;
  language: string | null;
  match_mode: SubjectMatchMode;
  auto_match_enabled: boolean;
};

export type WorkSubjectMatch = {
  workId: number;
  subjectId: string;
  source: AutoWorkSubjectSource;
  matchedAlias: string;
  confidence: number;
};

export type SubjectGroupMembership = {
  personSubjectId: string;
  groupSubjectId: string;
  relationType: SubjectGroupRelationType;
  active: boolean;
};

export type AliasConflict = {
  alias: string;
  normalized_alias: string;
  subject_id: string;
  name_ko: string | null;
  slug: string;
};

export function isSubjectType(
  value: unknown,
): value is SubjectType {
  return (
    typeof value === "string" &&
    (SUBJECT_TYPES as readonly string[]).includes(value)
  );
}

export function isSubjectCategory(
  value: unknown,
): value is SubjectCategory {
  return (
    typeof value === "string" &&
    (SUBJECT_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isSubjectMatchMode(
  value: unknown,
): value is SubjectMatchMode {
  return (
    typeof value === "string" &&
    (SUBJECT_MATCH_MODES as readonly string[]).includes(value)
  );
}

export function isSubjectLanguage(
  value: unknown,
): value is SubjectLanguage {
  return (
    typeof value === "string" &&
    (SUBJECT_LANGUAGES as readonly string[]).includes(value)
  );
}

export function isSubjectGroupRelationType(
  value: unknown,
): value is SubjectGroupRelationType {
  return (
    typeof value === "string" &&
    (SUBJECT_GROUP_RELATION_TYPES as readonly string[]).includes(value)
  );
}
