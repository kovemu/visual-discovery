import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  OPENAI_ARTIST_PROFILE_MODEL,
  generateArtistProfileWithOpenAI,
  parseArtistProfileGenerationInput,
  sanitizeAiErrorMessage,
} from "@/lib/ai/generateArtistProfile";

import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/requireAdmin";

const USER_FACING_ERROR =
  "AI profile generation failed. Please try again.";

export async function POST(
  request: NextRequest,
) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return adminAuthErrorResponse(auth);
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "AI profile generation is not configured.",
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
          "Invalid profile generation request.",
      },
      { status: 400 },
    );
  }

  const input =
    parseArtistProfileGenerationInput(
      body,
    );

  if (!input) {
    return NextResponse.json(
      {
        error:
          "Artist name is required.",
      },
      { status: 400 },
    );
  }

  try {
    const result =
      await generateArtistProfileWithOpenAI(
        input,
      );

    return NextResponse.json({
      ok: true,
      model: OPENAI_ARTIST_PROFILE_MODEL,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? sanitizeAiErrorMessage(
            error.message,
          )
        : "Unexpected OpenAI API error.";

    console.error(
      "OPENAI ARTIST PROFILE ERROR:",
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
