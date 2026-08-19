import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  DISCOVER_CATEGORIES,
  getDiscoverCandidateBatch,
} from "@/lib/discover/getRealDiscoverWorks";

export async function GET(
  request: NextRequest,
) {
  const category =
    request.nextUrl.searchParams.get(
      "category",
    );

  const roundValue =
    request.nextUrl.searchParams.get(
      "round",
    );

  if (
    !category ||
    !DISCOVER_CATEGORIES.some(
      (item) =>
        item.toLowerCase() ===
        category.toLowerCase(),
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Valid category is required.",
      },
      { status: 400 },
    );
  }

  const round = Number(
    roundValue ?? 0,
  );

  const batch =
    await getDiscoverCandidateBatch(
      category,
      Number.isFinite(round)
        ? round
        : 0,
    );

  return NextResponse.json({
    works: batch.works,
    nextRound: batch.nextRound,
    artistPageCount:
      batch.artistPageCount,
    artistPage: batch.artistPage,
    workPage: batch.workPage,
  });
}
