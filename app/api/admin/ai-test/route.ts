import {
  NextResponse,
} from "next/server";

import OpenAI from "openai";

const OPENAI_MODEL =
  "gpt-4o-mini";

const DISCOVERY_JUDGMENT_SCHEMA =
  {
    type: "object",
    properties: {
      contentType: {
        type: "string",
      },
      discoveryScore: {
        type: "number",
      },
      action: {
        type: "string",
        enum: [
          "keep",
          "skip",
        ],
      },
      reason: {
        type: "string",
      },
    },
    required: [
      "contentType",
      "discoveryScore",
      "action",
      "reason",
    ],
    additionalProperties:
      false,
  } as const;

type DiscoveryJudgment = {
  contentType: string;
  discoveryScore: number;
  action: "keep" | "skip";
  reason: string;
};

function sanitizeErrorMessage(
  message: string,
) {
  return message.replace(
    /sk-[A-Za-z0-9_-]+/g,
    "[REDACTED]",
  );
}

export async function POST() {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not configured.",
      },
      { status: 500 },
    );
  }

  const client = new OpenAI({
    apiKey,
  });

  try {
    const response =
      await client.responses.parse(
        {
          model: OPENAI_MODEL,
          input: [
            {
              role: "system",
              content:
                "You evaluate whether a K-pop work is suitable for Kovemu Discover. Kovemu helps users discover new K-pop artists by showing music and performance content to first-time viewers. Judge whether the work is good for introducing the artist's music and performance to someone who does not know them yet. Respond only with the requested JSON fields.",
            },
            {
              role: "user",
              content:
                "Artist: ICHILLIN'\nTitle: ICHILLIN' ON MY LIPS Live Performance",
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name:
                "kovemu_discovery_judgment",
              strict: true,
              schema:
                DISCOVERY_JUDGMENT_SCHEMA,
              description:
                "Kovemu Discover suitability judgment for a K-pop work.",
            },
          },
        },
      );

    const result =
      response.output_parsed as DiscoveryJudgment | null;

    if (!result) {
      return NextResponse.json(
        {
          error:
            "OpenAI returned no parsed judgment.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      model: OPENAI_MODEL,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? sanitizeErrorMessage(
            error.message,
          )
        : "Unexpected OpenAI API error.";

    console.error(
      "OPENAI AI TEST ERROR:",
      message,
    );

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
