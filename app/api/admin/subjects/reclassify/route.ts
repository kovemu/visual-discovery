import { NextRequest, NextResponse } from "next/server";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";
import {
  classifyWorksSubjects,
  loadClassifiableWorksByCategory,
} from "@/lib/subjects/classifyWorks.server";
import { createSubjectAdminClient } from "@/lib/subjects/subjectAdmin";
import {
  isSubjectCategory,
  type SubjectCategory,
} from "@/lib/subjects/subjectTypes";

const CHUNK_SIZE = 400;

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
    const body = await request.json().catch(() => ({}));
    const requestedCategory = body.category;
    const subjectId =
      typeof body.subjectId === "string" ? body.subjectId : null;

    let category: SubjectCategory | null = isSubjectCategory(
      requestedCategory,
    )
      ? requestedCategory
      : null;

    if (!category && subjectId) {
      const { data, error } = await supabase
        .from("subjects")
        .select("category")
        .eq("id", subjectId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (isSubjectCategory(data?.category)) {
        category = data.category;
      }
    }

    if (!category) {
      return NextResponse.json(
        { error: "A valid category is required." },
        { status: 400 },
      );
    }

    let processed = 0;
    let matchCount = 0;
    let offset = 0;

    while (true) {
      const works = await loadClassifiableWorksByCategory(
        supabase,
        category,
        {
          from: offset,
          to: offset + CHUNK_SIZE - 1,
        },
      );

      if (works.length === 0) {
        break;
      }

      const result = await classifyWorksSubjects(
        supabase,
        works.map((work) => work.id),
      );

      processed += works.length;
      matchCount += result.matchCount;
      offset += CHUNK_SIZE;

      if (works.length < CHUNK_SIZE) {
        break;
      }
    }

    return NextResponse.json({
      success: true,
      category,
      processed,
      matchCount,
    });
  } catch (error) {
    console.error("ADMIN SUBJECT RECLASSIFY ERROR:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
