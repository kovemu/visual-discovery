import { NextRequest, NextResponse } from "next/server";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";
import { normalizeSubjectAlias } from "@/lib/subjects/normalizeSubjectText";
import {
  createSubjectAdminClient,
  asOptionalText,
  findAliasConflicts,
  parseAliasInputs,
  slugifySubject,
} from "@/lib/subjects/subjectAdmin";
import {
  isSubjectCategory,
  isSubjectType,
} from "@/lib/subjects/subjectTypes";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  const supabase = createSubjectAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server configuration is missing." },
      { status: 500 },
    );
  }

  const category = request.nextUrl.searchParams.get("category");

  try {
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
          created_at,
          work_subjects(count)
        `,
      )
      .order("name_ko", { ascending: true, nullsFirst: false })
      .order("slug", { ascending: true });

    if (isSubjectCategory(category)) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const subjects = (data ?? []).map((row) => ({
      ...row,
      work_count: Array.isArray(row.work_subjects)
        ? (row.work_subjects[0]?.count ?? 0)
        : 0,
    }));

    return NextResponse.json({ subjects });
  } catch (error) {
    console.error("ADMIN SUBJECTS LIST ERROR:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  const supabase = createSubjectAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server configuration is missing." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const type = body.type;
    const category = body.category;
    const nameKo = asOptionalText(body.name_ko);
    const nameEn = asOptionalText(body.name_en);
    const nameZhTw = asOptionalText(body.name_zh_tw);
    const slugInput = asOptionalText(body.slug);
    const slug = slugifySubject(
      slugInput ?? nameKo ?? nameEn ?? nameZhTw ?? "",
    );

    if (!isSubjectType(type) || !isSubjectCategory(category)) {
      return NextResponse.json(
        { error: "Valid type and category are required." },
        { status: 400 },
      );
    }

    if (!nameKo && !nameEn && !nameZhTw) {
      return NextResponse.json(
        { error: "At least one name is required." },
        { status: 400 },
      );
    }

    if (!slug) {
      return NextResponse.json(
        { error: "A slug is required." },
        { status: 400 },
      );
    }

    const aliases = parseAliasInputs(body.aliases);
    const conflicts = await findAliasConflicts(supabase, category, aliases);

    const { data: subject, error } = await supabase
      .from("subjects")
      .insert({
        type,
        category,
        slug,
        name_ko: nameKo,
        name_en: nameEn,
        name_zh_tw: nameZhTw,
        active: body.active !== false,
      })
      .select("id")
      .single();

    if (error || !subject) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create subject." },
        { status: 400 },
      );
    }

    if (aliases.length > 0) {
      const { error: aliasError } = await supabase
        .from("subject_aliases")
        .insert(
          aliases.map((alias) => ({
            subject_id: subject.id,
            alias: alias.alias,
            normalized_alias: normalizeSubjectAlias(alias.alias),
            language: alias.language,
            match_mode: alias.match_mode,
            auto_match_enabled: alias.auto_match_enabled,
          })),
        );

      if (aliasError) {
        return NextResponse.json(
          {
            error: aliasError.message,
            subjectId: subject.id,
            aliasConflicts: conflicts,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      subjectId: subject.id,
      aliasConflicts: conflicts,
    });
  } catch (error) {
    console.error("ADMIN SUBJECT CREATE ERROR:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
