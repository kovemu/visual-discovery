import { NextRequest, NextResponse } from "next/server";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";
import { normalizeSubjectAlias } from "@/lib/subjects/normalizeSubjectText";
import {
  asOptionalText,
  createSubjectAdminClient,
  findAliasConflicts,
  parseAliasInputs,
  parseMembershipInputs,
  replacePersonGroupMemberships,
  slugifySubject,
} from "@/lib/subjects/subjectAdmin";
import {
  isSubjectCategory,
  isSubjectType,
} from "@/lib/subjects/subjectTypes";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
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

  const { id } = await context.params;

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
        created_at,
        updated_at,
        subject_aliases (
          id,
          alias,
          normalized_alias,
          language,
          match_mode,
          auto_match_enabled
        )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Subject not found." }, { status: 404 });
  }

  return NextResponse.json({ subject: data });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
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

  const { id } = await context.params;

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
    const conflicts = await findAliasConflicts(
      supabase,
      category,
      aliases,
      id,
    );

    const { error } = await supabase
      .from("subjects")
      .update({
        type,
        category,
        slug,
        name_ko: nameKo,
        name_en: nameEn,
        name_zh_tw: nameZhTw,
        active: body.active !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from("subject_aliases")
      .delete()
      .eq("subject_id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 },
      );
    }

    if (aliases.length > 0) {
      const { error: aliasError } = await supabase
        .from("subject_aliases")
        .insert(
          aliases.map((alias) => ({
            subject_id: id,
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
            aliasConflicts: conflicts,
          },
          { status: 400 },
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "memberships")) {
      try {
        await replacePersonGroupMemberships(
          supabase,
          id,
          type === "person" ? parseMembershipInputs(body.memberships) : [],
        );
      } catch (membershipError) {
        return NextResponse.json(
          {
            error:
              membershipError instanceof Error
                ? membershipError.message
                : "Failed to save group memberships.",
            aliasConflicts: conflicts,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      aliasConflicts: conflicts,
    });
  } catch (error) {
    console.error("ADMIN SUBJECT UPDATE ERROR:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
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

  const { id } = await context.params;

  const { error } = await supabase.from("subjects").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
