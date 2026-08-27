import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";

import { parseDiscoverTypesParam } from "@/lib/discover/discoverTypes";
import {
  parseDiscoverCategoriesParam,
} from "@/lib/discover/discoverCategorySelection";
import {
  parseDiscoverCategory,
} from "@/lib/discover/discoverRowCategories";
import type { CreatorCategory } from "@/lib/creator/creatorCategories";
import { getDiscoverCandidateBatch } from "@/lib/discover/getRealDiscoverWorks";

const WORKS_PER_BATCH = 36;

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

async function getWorkPageCount() {
  const supabase =
    await createClient();

  const {
    count,
    error,
  } = await supabase
    .from("works")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("featured", false);

  if (error) {
    console.log(
      "LOAD DISCOVER WORK PAGE COUNT ERROR:",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    return 1;
  }

  const workCount = count ?? 0;

  return Math.max(
    1,
    Math.ceil(
      workCount / WORKS_PER_BATCH,
    ),
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
      await getWorkPageCount();
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
