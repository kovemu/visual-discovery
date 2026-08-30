import {
  NextRequest,
  NextResponse,
} from "next/server";

import { parseDiscoverTypesParam } from "@/lib/discover/discoverTypes";
import {
  parseDiscoverCategoriesParam,
} from "@/lib/discover/discoverCategorySelection";
import {
  parseDiscoverCategory,
} from "@/lib/discover/discoverRowCategories";
import type { CreatorCategory } from "@/lib/creator/creatorCategories";
import {
  getDiscoverCandidateBatch,
  getDiscoverCandidatePageCount,
  normalizeDiscoverSearchQuery,
} from "@/lib/discover/getRealDiscoverWorks";

function resolveDiscoverCategories(
  request: NextRequest,
): CreatorCategory[] | null {
  const categoriesParam =
    request.nextUrl.searchParams.get(
      "categories",
    );

  if (categoriesParam !== null) {
    return parseDiscoverCategoriesParam(
      categoriesParam,
    );
  }

  const category =
    parseDiscoverCategory(
      request.nextUrl.searchParams.get(
        "category",
      ),
    );

  if (!category || category === "all") {
    return null;
  }

  return [category];
}

function deterministicStartOffset(
  seed: string,
  workPageCount: number,
) {
  if (
    !seed ||
    !Number.isFinite(
      workPageCount,
    ) ||
    workPageCount <= 1
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
    workPageCount
  );
}

function computeVirtualRound(
  clientRound: number,
  startOffset: number,
  workPageCount: number,
) {
  const round = Math.max(
    1,
    Math.floor(clientRound),
  );

  return (
    startOffset +
    round -
    1
  );
}

export async function GET(
  request: NextRequest,
) {
  const typesParam =
    request.nextUrl.searchParams.get(
      "types",
    );

  parseDiscoverTypesParam(
    typesParam,
  );

  const categories =
    resolveDiscoverCategories(request);

  const searchQuery =
    normalizeDiscoverSearchQuery(
      request.nextUrl.searchParams.get("q"),
    );

  const roundValue =
    request.nextUrl.searchParams.get(
      "round",
    );

  const seed =
    request.nextUrl.searchParams
      .get("seed")
      ?.trim() ?? "";

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
    const workPageCount =
      await getDiscoverCandidatePageCount(
        categories,
        searchQuery,
      );
    const startOffset =
      deterministicStartOffset(
        seed,
        workPageCount,
      );
    const virtualRound =
      computeVirtualRound(
        safeRound,
        startOffset,
        workPageCount,
      );
    const allowReuseRound0 =
      request.nextUrl.searchParams.get(
        "allowReuseRound0",
      ) === "true";

    const workPage =
      virtualRound % workPageCount;

    if (
      allowReuseRound0 &&
      virtualRound === 0
    ) {
      return NextResponse.json({
        works: [],
        reusedInitialBatch: true,
        nextRound: safeRound + 1,
        artistPageCount: workPageCount,
        artistPage: workPage,
        workPage,
      });
    }

    const batch =
      await getDiscoverCandidateBatch(
        categories,
        virtualRound,
        searchQuery,
      );

    return NextResponse.json({
      works: batch.works,
      nextRound: safeRound + 1,
      artistPageCount: workPageCount,
      artistPage: workPage,
      workPage,
    });
  }

  const batch =
    await getDiscoverCandidateBatch(
      categories,
      safeRound,
      searchQuery,
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
