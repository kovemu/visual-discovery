import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";

import {
  DISCOVER_CATEGORIES,
  getDiscoverCandidateBatch,
} from "@/lib/discover/getRealDiscoverWorks";

const ARTISTS_PER_BATCH = 10;

function normalizeCategory(
  category: string,
) {
  return category.trim().toLowerCase();
}

function deterministicStartOffset(
  seed: string,
  artistPageCount: number,
) {
  if (
    !seed ||
    !Number.isFinite(
      artistPageCount,
    ) ||
    artistPageCount <= 1
  ) {
    return 0;
  }

  let hash = 2166136261;

  for (
    let index = 0;
    index < seed.length;
    index += 1
  ) {
    hash ^=
      seed.charCodeAt(index);
    hash = Math.imul(
      hash,
      16777619,
    );
  }

  return (
    Math.abs(hash) %
    artistPageCount
  );
}

function computeVirtualRound(
  clientRound: number,
  startOffset: number,
  artistPageCount: number,
) {
  const round = Math.max(
    1,
    Math.floor(clientRound),
  );
  const artistPage =
    (startOffset +
      round -
      1) %
    artistPageCount;
  const workPage = Math.floor(
    (round - 1) /
      artistPageCount,
  );

  return (
    workPage * artistPageCount +
    artistPage
  );
}

async function getArtistPageCount(
  category: string,
) {
  const supabase =
    await createClient();

  const {
    count,
    error,
  } = await supabase
    .from("creators")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "category",
      normalizeCategory(
        category,
      ),
    );

  if (error) {
    console.log(
      "LOAD DISCOVER ARTIST COUNT ERROR:",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    return 1;
  }

  const artistCount =
    count ?? 0;

  return Math.max(
    1,
    Math.ceil(
      artistCount /
        ARTISTS_PER_BATCH,
    ),
  );
}

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

  const seed =
    request.nextUrl.searchParams
      .get("seed")
      ?.trim() ?? "";

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

  const clientRound = Number(
    roundValue ?? 0,
  );

  const safeRound =
    Number.isFinite(clientRound)
      ? Math.max(
          0,
          Math.floor(clientRound),
        )
      : 0;

  if (
    safeRound >= 1 &&
    seed
  ) {
    const artistPageCount =
      await getArtistPageCount(
        category,
      );
    const startOffset =
      deterministicStartOffset(
        seed,
        artistPageCount,
      );
    const virtualRound =
      computeVirtualRound(
        safeRound,
        startOffset,
        artistPageCount,
      );
    const allowReuseRound0 =
      request.nextUrl.searchParams.get(
        "allowReuseRound0",
      ) === "true";

    const artistPage =
      (startOffset +
        safeRound -
        1) %
      artistPageCount;
    const workPage = Math.floor(
      (safeRound - 1) /
        artistPageCount,
    );

    if (
      allowReuseRound0 &&
      virtualRound === 0
    ) {
      return NextResponse.json({
        works: [],
        reusedInitialBatch: true,
        nextRound: safeRound + 1,
        artistPageCount,
        artistPage,
        workPage,
      });
    }

    const batch =
      await getDiscoverCandidateBatch(
        category,
        virtualRound,
      );

    return NextResponse.json({
      works: batch.works,
      nextRound: safeRound + 1,
      artistPageCount,
      artistPage,
      workPage,
    });
  }

  const batch =
    await getDiscoverCandidateBatch(
      category,
      safeRound,
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
