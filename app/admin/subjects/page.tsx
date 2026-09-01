import Link from "next/link";

import ReclassifyCategoryButton from "@/components/admin/ReclassifyCategoryButton";
import { createSubjectAdminClient } from "@/lib/subjects/subjectAdmin";
import {
  CREATOR_CATEGORY_OPTIONS,
  formatCreatorCategoryLabel,
} from "@/lib/creator/creatorCategories";
import { isSubjectCategory } from "@/lib/subjects/subjectTypes";

type SubjectListRow = {
  id: string;
  type: string;
  category: string;
  slug: string;
  name_ko: string | null;
  name_en: string | null;
  name_zh_tw: string | null;
  active: boolean;
  work_subjects: { count: number }[] | null;
};

type AdminSubjectsPageProps = {
  searchParams: Promise<{
    category?: string;
  }>;
};

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  ...CREATOR_CATEGORY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  })),
] as const;

export default async function AdminSubjectsPage({
  searchParams,
}: AdminSubjectsPageProps) {
  const params = await searchParams;
  const requested = params.category?.toLowerCase() ?? "all";
  const validCategory = isSubjectCategory(requested) ? requested : "all";
  const supabase = createSubjectAdminClient();

  if (!supabase) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-sm text-red-600">
            Supabase server configuration is missing.
          </p>
        </div>
      </main>
    );
  }

  let query = supabase
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
        work_subjects(count)
      `,
    )
    .order("name_ko", { ascending: true, nullsFirst: false })
    .order("slug", { ascending: true });

  if (validCategory !== "all") {
    query = query.eq("category", validCategory);
  }

  const { data, error } = await query;

  if (error) {
    console.error("LOAD ADMIN SUBJECTS ERROR:", error);
  }

  const subjects = (data ?? []) as SubjectListRow[];

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <section className="mb-10">
          <p className="text-sm font-medium text-zinc-500">Kovemu Admin</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
                Subjects
              </h1>
              <p className="mt-3 text-sm text-zinc-500">
                People and groups appearing in works. Creators remain
                uploaders.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/artists"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-medium"
              >
                Artists
              </Link>
              <Link
                href="/admin/subjects/new"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white"
              >
                New Subject
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-7">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => {
              const selected = validCategory === option.value;
              const href =
                option.value === "all"
                  ? "/admin/subjects"
                  : `/admin/subjects?category=${option.value}`;

              return (
                <Link
                  key={option.value}
                  href={href}
                  className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium ${
                    selected
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-600"
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
          <span>{subjects.length} subjects</span>
          <ReclassifyCategoryButton category={validCategory} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Works</th>
                <th className="px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => {
                const workCount = subject.work_subjects?.[0]?.count ?? 0;

                return (
                  <tr
                    key={subject.id}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/subjects/${subject.id}`}
                        className="font-medium text-zinc-950 hover:underline"
                      >
                        {subject.name_ko ||
                          subject.name_en ||
                          subject.name_zh_tw ||
                          subject.slug}
                      </Link>
                      {subject.name_en && subject.name_ko ? (
                        <p className="text-xs text-zinc-400">
                          {subject.name_en}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{subject.type}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {formatCreatorCategoryLabel(subject.category)}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{subject.slug}</td>
                    <td className="px-4 py-3">{workCount}</td>
                    <td className="px-4 py-3">
                      {subject.active ? "yes" : "no"}
                    </td>
                  </tr>
                );
              })}
              {subjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-zinc-400"
                  >
                    No subjects yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
