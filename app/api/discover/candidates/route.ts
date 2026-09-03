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
import { parseDiscoverSubjectId } from "@/lib/discover/discoverSubjectFilter";
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

function hashDiscoverSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function greatestCommonDivisor(a: number, b: number) {
  let left = Math.abs(Math.floor(a));
  let right = Math.abs(Math.floor(b));

  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }

  return left;
}

function deterministicPageForRound(
  seed: string,
  clientRound: number,
  workPageCount: number,
) {
  if (
    !seed ||
    !Number.isFinite(workPageCount) ||
    workPageCount <= 1
  ) {
    return 0;
  }

  const pageCount = Math.max(1, Math.floor(workPageCount));
  const start = hashDiscoverSeed(`${seed}:start`) % pageCount;
  let stride =
    1 +
    (hashDiscoverSeed(`${seed}:stride`) % Math.max(1, pageCount - 1));

  while (greatestCommonDivisor(stride, pageCount) !== 1) {
    stride += 1;

    if (stride >= pageCount) {
      stride = 1;
    }
  }

  const logicalIndex = Math.max(
    0,
    Math.floor(clientRound) - 1,
  );

  return (start + (logicalIndex % pageCount) * stride) % pageCount;
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

  const subjectId = searchQuery
    ? null
    : parseDiscoverSubjectId(
        request.nextUrl.searchParams.get(
          "subjectId",
        ),
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
        subjectId,
      );
    const workPage = deterministicPageForRound(
      seed,
      safeRound,
      workPageCount,
    );
    const allowReuseRound0 =
      request.nextUrl.searchParams.get(
        "allowReuseRound0",
      ) === "true";

    if (
      allowReuseRound0 &&
      safeRound === 1 &&
      workPage === 0
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
        workPage,
        searchQuery,
        subjectId,
      );

    return NextResponse.json({
      works: batch.works,
      nextRound: safeRound + 1,
      artistPageCount: workPageCount,
      artistPage: workPage,
      workPage,
      ...(typeof batch.subjectMatchCount === "number"
        ? {
            subjectMatchCount:
              batch.subjectMatchCount,
          }
        : {}),
    });
  }

  const batch =
    await getDiscoverCandidateBatch(
      categories,
      safeRound,
      searchQuery,
      subjectId,
    );

  return NextResponse.json({
    works: batch.works,
    nextRound: batch.nextRound,
    artistPageCount:
      batch.artistPageCount,
    artistPage: batch.artistPage,
    workPage: batch.workPage,
    ...(typeof batch.subjectMatchCount === "number"
      ? {
          subjectMatchCount:
            batch.subjectMatchCount,
        }
      : {}),
  });
}
