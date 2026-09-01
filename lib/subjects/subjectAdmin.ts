import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { normalizeSubjectAlias } from "@/lib/subjects/normalizeSubjectText";
import {
  isSubjectGroupRelationType,
  isSubjectMatchMode,
  type AliasConflict,
  type SubjectCategory,
  type SubjectGroupRelationType,
  type SubjectMatchMode,
} from "@/lib/subjects/subjectTypes";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createSubjectAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function asOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export function slugifySubject(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type AliasInput = {
  id?: number;
  alias: string;
  language: string | null;
  match_mode: SubjectMatchMode;
  auto_match_enabled: boolean;
};

export function parseAliasInputs(value: unknown): AliasInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const aliases: AliasInput[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const raw = item as {
      id?: unknown;
      alias?: unknown;
      language?: unknown;
      match_mode?: unknown;
      auto_match_enabled?: unknown;
    };

    const alias = asOptionalText(raw.alias);

    if (!alias) {
      continue;
    }

    const normalized = normalizeSubjectAlias(alias);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);

    aliases.push({
      id:
        typeof raw.id === "number" && Number.isFinite(raw.id)
          ? raw.id
          : undefined,
      alias,
      language: asOptionalText(raw.language),
      match_mode: isSubjectMatchMode(raw.match_mode)
        ? raw.match_mode
        : "substring",
      auto_match_enabled: raw.auto_match_enabled !== false,
    });
  }

  return aliases;
}

export async function findAliasConflicts(
  supabase: SupabaseClient,
  category: SubjectCategory,
  aliases: AliasInput[],
  excludeSubjectId?: string,
): Promise<AliasConflict[]> {
  if (aliases.length === 0) {
    return [];
  }

  const normalized = aliases.map((alias) =>
    normalizeSubjectAlias(alias.alias),
  );

  let query = supabase
    .from("subject_aliases")
    .select(
      `
        alias,
        normalized_alias,
        subject_id,
        subjects!inner (
          id,
          slug,
          name_ko,
          category,
          active
        )
      `,
    )
    .in("normalized_alias", normalized)
    .eq("subjects.category", category)
    .eq("subjects.active", true);

  if (excludeSubjectId) {
    query = query.neq("subject_id", excludeSubjectId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).flatMap((row) => {
    const subject = Array.isArray(row.subjects)
      ? row.subjects[0]
      : row.subjects;

    if (!subject) {
      return [];
    }

    return [
      {
        alias: row.alias as string,
        normalized_alias: row.normalized_alias as string,
        subject_id: row.subject_id as string,
        name_ko: (subject.name_ko as string | null) ?? null,
        slug: subject.slug as string,
      },
    ];
  });
}

export type MembershipInput = {
  group_subject_id: string;
  relation_type: SubjectGroupRelationType;
};

export function parseMembershipInputs(value: unknown): MembershipInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const memberships: MembershipInput[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const raw = item as {
      group_subject_id?: unknown;
      relation_type?: unknown;
    };
    const groupSubjectId = asOptionalText(raw.group_subject_id);

    if (!groupSubjectId || seen.has(groupSubjectId)) {
      continue;
    }

    seen.add(groupSubjectId);
    memberships.push({
      group_subject_id: groupSubjectId,
      relation_type: isSubjectGroupRelationType(raw.relation_type)
        ? raw.relation_type
        : "current",
    });
  }

  return memberships;
}

export async function replacePersonGroupMemberships(
  supabase: SupabaseClient,
  personSubjectId: string,
  memberships: MembershipInput[],
) {
  const { data: person, error: personError } = await supabase
    .from("subjects")
    .select("id, type, category")
    .eq("id", personSubjectId)
    .maybeSingle();

  if (personError) {
    throw personError;
  }

  const { error: deleteError } = await supabase
    .from("subject_group_memberships")
    .delete()
    .eq("person_subject_id", personSubjectId);

  if (deleteError) {
    throw deleteError;
  }

  if (
    !person ||
    person.type !== "person" ||
    memberships.length === 0
  ) {
    return;
  }

  const groupIds = memberships.map((item) => item.group_subject_id);
  const { data: groups, error: groupError } = await supabase
    .from("subjects")
    .select("id, type, category")
    .in("id", groupIds)
    .eq("type", "group")
    .eq("category", person.category);

  if (groupError) {
    throw groupError;
  }

  const validGroupIds = new Set((groups ?? []).map((group) => group.id));
  const rows = memberships
    .filter((item) => validGroupIds.has(item.group_subject_id))
    .map((item) => ({
      person_subject_id: personSubjectId,
      group_subject_id: item.group_subject_id,
      relation_type: item.relation_type,
      active: true,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("subject_group_memberships")
    .insert(rows);

  if (insertError) {
    throw insertError;
  }
}
