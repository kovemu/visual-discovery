import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  adminAuthErrorResponse,
  requireAdmin,
} from "@/lib/auth/requireAdmin";
import { classifyWorksSubjectsSafe } from "@/lib/subjects/classifyWorks.server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_CATEGORIES = new Set(["kpop", "cheer"]);
const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected"]);

const FALLBACK_CREATOR_USERNAME: Record<string, string> = {
  kpop: "admin_kpop",
  cheer: "admin_cheer",
};

type CandidateRow = {
  id: number;
  category: "kpop" | "cheer";
  source: "youtube";
  source_id: string;
  source_url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  view_count: number | null;
  like_count: number | null;
  channel_id: string | null;
  channel_title: string | null;
  target_artist_id: string | null;
  subject_id: string | null;
  subject_name: string | null;
  heuristic_score: number | null;
  ai_score: number | null;
  ai_reason: string | null;
  ai_content_type: string | null;
  score_breakdown: Record<string, unknown> | null;
  status: "pending" | "approved" | "rejected";
  batch_key: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function parseIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isSafeInteger(item) && item > 0),
    ),
  ).slice(0, 300);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return adminAuthErrorResponse(auth);

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase server configuration is missing." },
      { status: 500 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedStatus = searchParams.get("status")?.toLowerCase() ?? "pending";
  const requestedCategory = searchParams.get("category")?.toLowerCase() ?? "all";
  const status = ALLOWED_STATUSES.has(requestedStatus)
    ? requestedStatus
    : "pending";
  const category = ALLOWED_CATEGORIES.has(requestedCategory)
    ? requestedCategory
    : "all";

  let query = supabaseAdmin
    .from("ai_import_candidates")
    .select(
      `
        id,
        category,
        source,
        source_id,
        source_url,
        title,
        description,
        thumbnail_url,
        published_at,
        duration_seconds,
        view_count,
        like_count,
        channel_id,
        channel_title,
        target_artist_id,
        subject_id,
        subject_name,
        heuristic_score,
        ai_score,
        ai_reason,
        ai_content_type,
        score_breakdown,
        status,
        batch_key,
        imported_work_id,
        created_at,
        reviewed_at,
        target_artist:creators!ai_import_candidates_target_artist_id_fkey(
          id,
          name,
          username,
          category
        )
      `,
    )
    .eq("status", status)
    .order("ai_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (category !== "all") {
    query = query.eq("category", category);
  }

  const [{ data, error }, { data: countRows, error: countError }] =
    await Promise.all([
      query,
      supabaseAdmin
        .from("ai_import_candidates")
        .select("status, category"),
    ]);

  if (error) {
    console.error("AI IMPORT CANDIDATES LOAD ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (countError) {
    console.error("AI IMPORT CANDIDATE COUNTS ERROR:", countError);
  }

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    pendingKpop: 0,
    pendingCheer: 0,
  };

  for (const row of countRows ?? []) {
    if (row.status === "pending") {
      counts.pending += 1;
      if (row.category === "kpop") counts.pendingKpop += 1;
      if (row.category === "cheer") counts.pendingCheer += 1;
    } else if (row.status === "approved") {
      counts.approved += 1;
    } else if (row.status === "rejected") {
      counts.rejected += 1;
    }
  }

  return NextResponse.json({ candidates: data ?? [], counts });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return adminAuthErrorResponse(auth);

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase server configuration is missing." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const action = body.action;
    const ids = parseIds(body.ids);

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: "No candidates selected." }, { status: 400 });
    }

    const { data: rawCandidates, error: candidateError } = await supabaseAdmin
      .from("ai_import_candidates")
      .select("*")
      .in("id", ids)
      .eq("status", "pending");

    if (candidateError) {
      return NextResponse.json({ error: candidateError.message }, { status: 400 });
    }

    const candidates = (rawCandidates ?? []).filter(
      (candidate): candidate is CandidateRow =>
        ALLOWED_CATEGORIES.has(candidate.category) && candidate.source === "youtube",
    );

    if (candidates.length === 0) {
      return NextResponse.json({ success: true, reviewedCount: 0, importedCount: 0 });
    }

    const reviewedAt = new Date().toISOString();

    if (action === "reject") {
      const { error: rejectError } = await supabaseAdmin
        .from("ai_import_candidates")
        .update({ status: "rejected", reviewed_at: reviewedAt })
        .in("id", candidates.map((candidate) => candidate.id));

      if (rejectError) {
        return NextResponse.json({ error: rejectError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        reviewedCount: candidates.length,
        importedCount: 0,
      });
    }

    const { data: fallbackCreators, error: creatorError } = await supabaseAdmin
      .from("creators")
      .select("id, username, category")
      .in("username", ["admin_kpop", "admin_cheer"]);

    if (creatorError) {
      return NextResponse.json({ error: creatorError.message }, { status: 400 });
    }

    const fallbackByCategory = new Map<string, string>();
    for (const creator of fallbackCreators ?? []) {
      if (
        typeof creator.category === "string" &&
        typeof creator.id === "string" &&
        creator.username === FALLBACK_CREATOR_USERNAME[creator.category]
      ) {
        fallbackByCategory.set(creator.category, creator.id);
      }
    }

    const unresolvedCategory = candidates.find(
      (candidate) =>
        !candidate.target_artist_id && !fallbackByCategory.has(candidate.category),
    );
    if (unresolvedCategory) {
      return NextResponse.json(
        { error: `Fallback creator for ${unresolvedCategory.category} is missing.` },
        { status: 400 },
      );
    }

    const sourceIds = candidates.map((candidate) => candidate.source_id);
    const { data: existingWorks, error: existingError } = await supabaseAdmin
      .from("works")
      .select("id, source_id, discover_eligible")
      .eq("source", "youtube")
      .in("source_id", sourceIds);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    const existingBySourceId = new Map(
      (existingWorks ?? []).map((work) => [work.source_id, work]),
    );
    const newCandidates = candidates.filter(
      (candidate) => !existingBySourceId.has(candidate.source_id),
    );

    const importedWorkBySourceId = new Map<string, number>();

    if (newCandidates.length > 0) {
      const rows = newCandidates.map((candidate) => ({
        artist_id:
          candidate.target_artist_id ?? fallbackByCategory.get(candidate.category)!,
        type: "video",
        source: "youtube",
        source_id: candidate.source_id,
        source_url: candidate.source_url,
        title: candidate.title,
        description: candidate.description,
        thumbnail_url: candidate.thumbnail_url,
        published_at: candidate.published_at,
        duration_seconds: candidate.duration_seconds,
        featured: false,
        discover_eligible: true,
        discover_category: candidate.category,
        rotation_degrees: 0,
        thumbnail_rotation_degrees: 0,
      }));

      const { data: insertedWorks, error: insertError } = await supabaseAdmin
        .from("works")
        .insert(rows)
        .select("id, source_id");

      if (insertError) {
        console.error("AI IMPORT APPROVE INSERT ERROR:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }

      for (const work of insertedWorks ?? []) {
        if (typeof work.source_id === "string" && typeof work.id === "number") {
          importedWorkBySourceId.set(work.source_id, work.id);
        }
      }
    }

    for (const work of existingWorks ?? []) {
      if (typeof work.source_id === "string" && typeof work.id === "number") {
        importedWorkBySourceId.set(work.source_id, work.id);
      }
    }

    const workIdsToClassify = Array.from(importedWorkBySourceId.values());
    await classifyWorksSubjectsSafe(supabaseAdmin, workIdsToClassify);

    await Promise.all(
      candidates.map(async (candidate) => {
        const { error: reviewError } = await supabaseAdmin
          .from("ai_import_candidates")
          .update({
            status: "approved",
            reviewed_at: reviewedAt,
            imported_work_id: importedWorkBySourceId.get(candidate.source_id) ?? null,
          })
          .eq("id", candidate.id);

        if (reviewError) throw reviewError;
      }),
    );

    return NextResponse.json({
      success: true,
      reviewedCount: candidates.length,
      importedCount: newCandidates.length,
      existingCount: existingWorks?.length ?? 0,
    });
  } catch (error) {
    console.error("AI IMPORT REVIEW SERVER ERROR:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
