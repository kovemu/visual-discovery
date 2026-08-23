import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ANALYZE_WORKS_BATCH_SIZE,
  OPENAI_WORK_ANALYSIS_MODEL,
  analyzeWorksWithOpenAI,
  parseWorkAnalysisCandidates,
  sanitizeAiErrorMessage,
} from "@/lib/ai/analyzeWorks";

const USER_FACING_ERROR =
  "AI analysis failed. Please try again.";

export async function POST(
  request: NextRequest,
) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "AI analysis is not configured.",
      },
      { status: 500 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid analysis request.",
      },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== "object"
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid analysis request.",
      },
      { status: 400 },
    );
  }

  const payload = body as {
    works?: unknown;
    artistName?: unknown;
  };

  const artistName =
    typeof payload.artistName ===
    "string"
      ? payload.artistName.trim()
      : "";

  const works =
    parseWorkAnalysisCandidates(
      payload.works,
      artistName || undefined,
    );

  if (works.length === 0) {
    return NextResponse.json(
      {
        error:
          "No valid works to analyze.",
      },
      { status: 400 },
    );
  }

  if (
    works.length >
    ANALYZE_WORKS_BATCH_SIZE
  ) {
    return NextResponse.json(
      {
        error: `A batch can include at most ${ANALYZE_WORKS_BATCH_SIZE} works.`,
      },
      { status: 400 },
    );
  }

  try {
    const results =
      await analyzeWorksWithOpenAI(
        works,
      );

    return NextResponse.json({
      ok: true,
      model: OPENAI_WORK_ANALYSIS_MODEL,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? sanitizeAiErrorMessage(
            error.message,
          )
        : "Unexpected OpenAI API error.";

    console.error(
      "OPENAI WORK ANALYSIS ERROR:",
      message,
    );

    return NextResponse.json(
      {
        error: USER_FACING_ERROR,
      },
      { status: 500 },
    );
  }
}
