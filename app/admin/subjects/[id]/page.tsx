import Link from "next/link";
import { notFound } from "next/navigation";

import SubjectForm from "@/components/admin/SubjectForm";
import { createSubjectAdminClient } from "@/lib/subjects/subjectAdmin";
import {
  isSubjectCategory,
  isSubjectGroupRelationType,
  isSubjectMatchMode,
  isSubjectType,
} from "@/lib/subjects/subjectTypes";

type SubjectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditSubjectPage({
  params,
}: SubjectPageProps) {
  const { id } = await params;
  const supabase = createSubjectAdminClient();

  if (!supabase) {
    notFound();
  }

  const { data, error } = await supabase
    .from("subjects")
    .select(
      `
        id,
        type,
        category,
        slug,
        name_ko,
        name_en,
        name_zh_tw,
        active,
        subject_aliases (
          alias,
          language,
          match_mode,
          auto_match_enabled
        )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("LOAD ADMIN SUBJECT ERROR:", error);
  }

  if (!data || !isSubjectType(data.type) || !isSubjectCategory(data.category)) {
    notFound();
  }

  const aliases = Array.isArray(data.subject_aliases)
    ? data.subject_aliases.map((alias) => ({
        alias: alias.alias,
        language: alias.language ?? "",
        match_mode: isSubjectMatchMode(alias.match_mode)
          ? alias.match_mode
          : "substring",
        auto_match_enabled: alias.auto_match_enabled !== false,
      }))
    : [];

  let memberships: Array<{
    group_subject_id: string;
    relation_type: "current" | "former";
  }> = [];
  let availableGroups: Array<{ id: string; name: string }> = [];

  if (data.type === "person" && data.category === "kpop") {
    const { data: membershipRows } = await supabase
      .from("subject_group_memberships")
      .select("group_subject_id, relation_type, active")
      .eq("person_subject_id", id)
      .eq("active", true);
    const { data: groupRows } = await supabase
      .from("subjects")
      .select("id, name_ko, name_en, slug")
      .eq("category", "kpop")
      .eq("type", "group")
      .eq("active", true)
      .order("name_ko", { ascending: true, nullsFirst: false });

    memberships = (membershipRows ?? []).flatMap((row) => {
      if (!isSubjectGroupRelationType(row.relation_type)) {
        return [];
      }

      return [
        {
          group_subject_id: row.group_subject_id,
          relation_type: row.relation_type,
        },
      ];
    });
    availableGroups = (groupRows ?? []).map((group) => ({
      id: group.id,
      name: group.name_ko || group.name_en || group.slug,
    }));
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/admin/subjects"
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Subjects
        </Link>
        <h1 className="mt-4 mb-8 text-3xl font-semibold tracking-tight">
          {data.name_ko || data.name_en || data.slug}
        </h1>
        <SubjectForm
          mode="edit"
          subjectId={data.id}
          initial={{
            type: data.type,
            category: data.category,
            slug: data.slug,
            name_ko: data.name_ko ?? "",
            name_en: data.name_en ?? "",
            name_zh_tw: data.name_zh_tw ?? "",
            active: data.active,
            aliases,
            memberships,
          }}
          availableGroups={availableGroups}
        />
      </div>
    </main>
  );
}
