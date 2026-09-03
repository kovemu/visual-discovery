import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  adminAuthErrorResponse,
  requireAdmin,
} from "@/lib/auth/requireAdmin";
import { collectAiImportCandidatesWeb } from "@/lib/ai-import/collectCandidatesWeb.server";
import { applyThumbnailStyleScores } from "@/lib/ai-import/thumbnailStyle.server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return adminAuthErrorResponse(auth);

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server configuration is missing." },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("ai_import_runs")
    .select("id, trigger_type, status, started_at, finished_at, stats, error_message")
    .order("started_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ runs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return adminAuthErrorResponse(auth);

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase server configuration is missing." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestedLimit = Number(body?.maxQueue ?? 200);
    const maxQueue = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(200, Math.round(requestedLimit)))
      : 200;

    const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentRun } = await supabase
      .from("ai_import_runs")
      .select("id, status, started_at")
      .gte("started_at", recentCutoff)
      .in("status", ["running", "success"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentRun) {
      return NextResponse.json(
        {
          error:
            recentRun.status === "running"
              ? "AI Import가 이미 실행 중입니다. 잠시 후 다시 확인해주세요."
              : "최근 30분 안에 이미 수집을 실행했습니다. YouTube 웹 검색 과도 호출 방지를 위해 잠시 후 다시 실행해주세요.",
          recentRun,
        },
        { status: 409 },
      );
    }

    const stats = await collectAiImportCandidatesWeb(supabase, {
      triggerType: "manual",
      maxQueue,
    });

    const batchKey = typeof stats.batchKey === "string" ? stats.batchKey : "";
    const runId = typeof stats.runId === "string" ? stats.runId : undefined;
    let thumbnailStyle = null;

    if (batchKey && Number(stats.queuedCount ?? 0) > 0) {
      try {
        thumbnailStyle = await applyThumbnailStyleScores(supabase, {
          batchKey,
          runId,
        });
      } catch (visualError) {
        console.error("THUMBNAIL STYLE SCORING ERROR:", visualError);
        thumbnailStyle = {
          error:
            visualError instanceof Error
              ? visualError.message
              : "Thumbnail style scoring failed.",
        };
      }
    }

    return NextResponse.json({
      success: true,
      stats: { ...stats, thumbnailStyle },
    });
  } catch (error) {
    console.error("MANUAL AI IMPORT COLLECT ERROR:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI Import collector failed.",
      },
      { status: 500 },
    );
  }
}
