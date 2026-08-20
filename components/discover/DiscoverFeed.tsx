"use client";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import AuthModal from "@/components/AuthModal";
import MyPicksPanel from "@/components/discover/MyPicksPanel";

export type FeedItem = {
  id: string;
  artistId: string;
  artistName: string;
  category: string;
  type?: "image" | "youtube";
  image?: string;
  videoId?: string;
  caption?: string | null;
  sourceUrl?: string;
  artistUrl?: string;
};




const categories = ["DISCOVER", "Music", "Dance", "Art", "Cosplay"] as const;

const DISCOVER_CATEGORY_STORAGE_KEY =
  "kovemu-discover-category";

type DiscoverCategory =
  (typeof categories)[number];

type CandidateCategory =
  Exclude<
    DiscoverCategory,
    "DISCOVER"
  >;

const candidateCategories: CandidateCategory[] =
  [
    "Music",
    "Dance",
    "Art",
    "Cosplay",
  ];

const CANDIDATE_REFILL_THRESHOLD = 24;

type CandidateBatchResponse = {
  works?: FeedItem[];
  nextRound?: number;
  artistPageCount?: number;
  artistPage?: number;
  workPage?: number;
};

type WorkPageCycleState = {
  workPage: number;
  artistPageCount: number;
  hasWorks: boolean;
};

function updateWorkPageCycleExhaustion(
  category: CandidateCategory,
  artistPage: number,
  artistPageCount: number,
  workPage: number,
  incomingCount: number,
  workPageCycleRef: MutableRefObject<
    Partial<
      Record<
        CandidateCategory,
        WorkPageCycleState
      >
    >
  >,
  exhaustedCategoriesRef: MutableRefObject<
    Set<CandidateCategory>
  >,
) {
  let state =
    workPageCycleRef.current[
      category
    ];

  if (
    state &&
    state.workPage !== workPage
  ) {
    if (!state.hasWorks) {
      exhaustedCategoriesRef.current.add(
        category,
      );
    }

    state = undefined;
  }

  if (!state) {
    state = {
      workPage,
      artistPageCount,
      hasWorks: incomingCount > 0,
    };
  } else {
    state.artistPageCount =
      artistPageCount;

    if (incomingCount > 0) {
      state.hasWorks = true;
    }
  }

  workPageCycleRef.current[category] =
    state;

  if (
    artistPage ===
    artistPageCount - 1
  ) {
    if (!state.hasWorks) {
      exhaustedCategoriesRef.current.add(
        category,
      );
    }

    delete workPageCycleRef.current[
      category
    ];
  }
}

function isValidDiscoverCategory(
  value: string | null,
): value is DiscoverCategory {
  if (!value) {
    return false;
  }

  return (
    categories as readonly string[]
  ).includes(value);
}

function readStoredDiscoverCategory(): DiscoverCategory {
  try {
    const stored =
      sessionStorage.getItem(
        DISCOVER_CATEGORY_STORAGE_KEY,
      );

    if (
      isValidDiscoverCategory(
        stored,
      )
    ) {
      return stored;
    }
  } catch {
    // ignore
  }

  return "DISCOVER";
}

function saveDiscoverCategory(
  category: string,
) {
  try {
    sessionStorage.setItem(
      DISCOVER_CATEGORY_STORAGE_KEY,
      category,
    );
  } catch {
    // ignore
  }
}

const DISCOVER_SET_SIZE = 12;

const DISCOVER_QUOTA: Record<string, number> = {
  Music: 6,
  Dance: 3,
  Art: 2,
  Cosplay: 1,
};

const RECENT_ARTIST_HISTORY_LIMIT = 32;

const VIDEO_HEIGHTS = [230, 280, 330];
const MASONRY_GAP = 16;

type DiscoverFeedProps = {
  works: FeedItem[];
};

type TransitionStage =
  | "idle"
  | "unpicked-out"
  | "picked-out"
  | "entering";

function shuffleWorks(works: FeedItem[]): FeedItem[] {
  const shuffled = [...works];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled;
}

function getWorkThumbnail(work: FeedItem) {
  if (work.image) return work.image;

  if (work.type === "youtube" && work.videoId) {
    return `https://i.ytimg.com/vi/${work.videoId}/maxresdefault.jpg`;
  }

  return "";
}

function getVideoHeightPx(work: FeedItem) {
  const key = work.videoId ?? work.id;
  let hash = 0;

  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 10000;
  }

  return VIDEO_HEIGHTS[hash % VIDEO_HEIGHTS.length];
}

function getResponsiveColumnCount(width: number) {
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  if (width >= 640) return 2;
  return 1;
}

function estimateWorkHeight(
  work: FeedItem,
  columnWidth: number,
  imageRatios: Record<string, number>,
) {
  const isYoutube =
    work.type === "youtube" &&
    Boolean(work.videoId);

  if (isYoutube) {
    return getVideoHeightPx(work);
  }

  const ratio =
    imageRatios[work.id];

  if (
    ratio &&
    ratio > 0
  ) {
    return columnWidth / ratio;
  }

  /*
    이미지 로딩 전 임시 추정치.
    세로형 이미지가 많은 Kovemu feed에 맞춰
    약간 세로로 긴 값을 사용.
  */
  return columnWidth * 1.18;
}

type BalancedLayout = {
  columns: FeedItem[][];
};

type LayoutCandidate = {
  columns: FeedItem[][];
  heights: number[];
};

function getLayoutScore(
  heights: number[],
) {
  if (heights.length <= 1) {
    return 0;
  }

  const tallest =
    Math.max(...heights);

  const shortest =
    Math.min(...heights);

  const average =
    heights.reduce(
      (sum, height) =>
        sum + height,
      0,
    ) / heights.length;

  /*
    가장 긴/짧은 컬럼 차이를 가장 중요하게 보고,
    평균에서 얼마나 벗어나는지도 함께 평가.
  */
  const spread =
    tallest - shortest;

  const variance =
    heights.reduce(
      (sum, height) =>
        sum +
        Math.pow(
          height - average,
          2,
        ),
      0,
    ) / heights.length;

  return (
    spread * 1000 +
    variance
  );
}

function buildBalancedLayout(
  works: FeedItem[],
  columnCount: number,
  columnWidth: number,
  imageRatios: Record<string, number>,
): BalancedLayout {
  const safeColumnCount =
    Math.max(
      1,
      columnCount,
    );

  if (
    works.length === 0
  ) {
    return {
      columns:
        Array.from(
          {
            length:
              safeColumnCount,
          },
          () => [],
        ),
    };
  }

  if (
    safeColumnCount === 1
  ) {
    return {
      columns: [
        [...works],
      ],
    };
  }

  /*
    각 카드의 예상 높이를 먼저 계산한다.

    이미지 비율은 그대로 유지하고,
    카드 자체를 늘이거나 줄이지 않는다.
  */
  const measuredWorks =
    works.map(
      (work, originalIndex) => ({
        work,
        originalIndex,
        height:
          estimateWorkHeight(
            work,
            columnWidth,
            imageRatios,
          ),
      }),
    );

  /*
    큰 카드부터 먼저 배치하면
    뒤에서 매우 긴 카드 하나 때문에
    특정 컬럼만 길어지는 현상을 줄일 수 있다.
  */
  const placementOrder =
    [...measuredWorks].sort(
      (a, b) =>
        b.height -
        a.height,
    );

  /*
    12개 / 4열이면 각 열이 보통 3개가 되도록 한다.
    반응형 3열/2열에서도 카드 수 차이가 1개를 넘지 않게 한다.
  */
  const minItemsPerColumn =
    Math.floor(
      works.length /
        safeColumnCount,
    );

  const maxItemsPerColumn =
    Math.ceil(
      works.length /
        safeColumnCount,
    );

  /*
    Greedy 한 번으로 끝내지 않고
    여러 배치 후보를 유지하는 Beam Search.

    12개 정도에서는 매우 가볍고,
    마지막 컬럼만 크게 튀는 경우를
    Greedy보다 훨씬 잘 줄인다.
  */
  const BEAM_WIDTH = 1200;

  let candidates: LayoutCandidate[] =
    [
      {
        columns:
          Array.from(
            {
              length:
                safeColumnCount,
            },
            () => [],
          ),
        heights:
          Array.from(
            {
              length:
                safeColumnCount,
            },
            () => 0,
          ),
      },
    ];

  for (
    let workIndex = 0;
    workIndex <
    placementOrder.length;
    workIndex += 1
  ) {
    const item =
      placementOrder[
        workIndex
      ];

    const remainingAfter =
      placementOrder.length -
      workIndex -
      1;

    const nextCandidates:
      LayoutCandidate[] =
      [];

    for (
      const candidate of
        candidates
    ) {
      for (
        let columnIndex = 0;
        columnIndex <
        safeColumnCount;
        columnIndex += 1
      ) {
        const currentCount =
          candidate.columns[
            columnIndex
          ].length;

        if (
          currentCount >=
          maxItemsPerColumn
        ) {
          continue;
        }

        /*
          남은 카드를 모두 사용해도
          어떤 컬럼이 최소 개수를 채울 수 없는
          후보는 일찍 제거한다.
        */
        const nextCounts =
          candidate.columns.map(
            (column, index) =>
              column.length +
              (index ===
              columnIndex
                ? 1
                : 0),
          );

        const totalMinimumNeeded =
          nextCounts.reduce(
            (sum, count) =>
              sum +
              Math.max(
                0,
                minItemsPerColumn -
                  count,
              ),
            0,
          );

        if (
          totalMinimumNeeded >
          remainingAfter
        ) {
          continue;
        }

        const nextColumns =
          candidate.columns.map(
            (column, index) =>
              index ===
              columnIndex
                ? [
                    ...column,
                    item.work,
                  ]
                : [...column],
          );

        const nextHeights =
          [
            ...candidate.heights,
          ];

        nextHeights[
          columnIndex
        ] +=
          item.height +
          (currentCount > 0
            ? MASONRY_GAP
            : 0);

        nextCandidates.push(
          {
            columns:
              nextColumns,
            heights:
              nextHeights,
          },
        );
      }
    }

    /*
      중간 단계에서도 높이 편차가 작은 후보만 유지.
      완성 단계에서는 아래에서 다시 정확히 최종 평가한다.
    */
    nextCandidates.sort(
      (a, b) =>
        getLayoutScore(
          a.heights,
        ) -
        getLayoutScore(
          b.heights,
        ),
    );

    candidates =
      nextCandidates.slice(
        0,
        BEAM_WIDTH,
      );
  }

  if (
    candidates.length === 0
  ) {
    /*
      혹시 모를 fallback.
    */
    const columns =
      Array.from(
        {
          length:
            safeColumnCount,
        },
        () => [] as FeedItem[],
      );

    const heights =
      Array.from(
        {
          length:
            safeColumnCount,
        },
        () => 0,
      );

    for (
      const item of
        placementOrder
    ) {
      let shortestIndex =
        0;

      for (
        let index = 1;
        index <
        safeColumnCount;
        index += 1
      ) {
        if (
          heights[index] <
          heights[
            shortestIndex
          ]
        ) {
          shortestIndex =
            index;
        }
      }

      columns[
        shortestIndex
      ].push(
        item.work,
      );

      heights[
        shortestIndex
      ] +=
        item.height +
        MASONRY_GAP;
    }

    return {
      columns,
    };
  }

  candidates.sort(
    (a, b) =>
      getLayoutScore(
        a.heights,
      ) -
      getLayoutScore(
        b.heights,
      ),
  );

  const best =
    candidates[0];

  /*
    각 컬럼 안에서는 원래 Discover Set의 순서를
    최대한 유지해서 화면이 지나치게 랜덤해 보이지 않게 한다.
  */
  const originalOrder =
    new Map(
      works.map(
        (work, index) => [
          work.id,
          index,
        ],
      ),
    );

  const orderedColumns =
    best.columns.map(
      (column) =>
        [...column].sort(
          (a, b) =>
            (originalOrder.get(
              a.id,
            ) ?? 0) -
            (originalOrder.get(
              b.id,
            ) ?? 0),
        ),
    );

  return {
    columns:
      orderedColumns,
  };
}

function normalizeCategory(category: string) {
  return category.trim().toLowerCase();
}

function countUniqueArtists(works: FeedItem[]) {
  return new Set(works.map((work) => work.artistId)).size;
}

function addWorksFromPool({
  pool,
  result,
  targetCount,
  artistLimit,
  recentArtistIds,
  avoidRecentArtists,
}: {
  pool: FeedItem[];
  result: FeedItem[];
  targetCount: number;
  artistLimit: number;
  recentArtistIds: Set<string>;
  avoidRecentArtists: boolean;
}) {
  if (result.length >= targetCount) return;

  const usedWorkIds = new Set(result.map((work) => work.id));
  const artistCounts = new Map<string, number>();

  for (const work of result) {
    artistCounts.set(work.artistId, (artistCounts.get(work.artistId) ?? 0) + 1);
  }

  for (const work of shuffleWorks(pool)) {
    if (result.length >= targetCount) break;
    if (usedWorkIds.has(work.id)) continue;
    if (avoidRecentArtists && recentArtistIds.has(work.artistId)) continue;

    const currentArtistCount = artistCounts.get(work.artistId) ?? 0;
    if (currentArtistCount >= artistLimit) continue;

    result.push(work);
    usedWorkIds.add(work.id);
    artistCounts.set(work.artistId, currentArtistCount + 1);
  }
}

function buildCategorySet(
  works: FeedItem[],
  category: string,
  recentArtists: string[],
) {
  const pool = works.filter(
    (work) => normalizeCategory(work.category) === normalizeCategory(category),
  );

  if (pool.length === 0) return [];

  const targetCount = Math.min(DISCOVER_SET_SIZE, pool.length);
  const recentArtistIds = new Set(recentArtists);
  const uniqueArtistCount = Math.max(1, countUniqueArtists(pool));
  const maxArtistLimit = Math.max(
    1,
    Math.ceil(targetCount / uniqueArtistCount) + 2,
  );

  for (let artistLimit = 1; artistLimit <= maxArtistLimit; artistLimit += 1) {
    const result: FeedItem[] = [];

    addWorksFromPool({
      pool,
      result,
      targetCount,
      artistLimit,
      recentArtistIds,
      avoidRecentArtists: true,
    });

    addWorksFromPool({
      pool,
      result,
      targetCount,
      artistLimit,
      recentArtistIds,
      avoidRecentArtists: false,
    });

    if (result.length >= targetCount) {
      return result.slice(0, targetCount);
    }
  }

  const fallback: FeedItem[] = [];

  addWorksFromPool({
    pool,
    result: fallback,
    targetCount,
    artistLimit: DISCOVER_SET_SIZE,
    recentArtistIds,
    avoidRecentArtists: false,
  });

  return fallback.slice(0, targetCount);
}

function fillDiscoverQuota(
  works: FeedItem[],
  recentArtistIds: Set<string>,
  artistLimit: number,
  targetCount: number,
) {
  const result: FeedItem[] = [];

  for (const [category, quota] of Object.entries(DISCOVER_QUOTA)) {
    const categoryPool = works.filter(
      (work) =>
        normalizeCategory(work.category) === normalizeCategory(category),
    );

    const categoryTarget = Math.min(
      targetCount,
      result.length + quota,
    );

    addWorksFromPool({
      pool: categoryPool,
      result,
      targetCount: categoryTarget,
      artistLimit,
      recentArtistIds,
      avoidRecentArtists: true,
    });

    addWorksFromPool({
      pool: categoryPool,
      result,
      targetCount: categoryTarget,
      artistLimit,
      recentArtistIds,
      avoidRecentArtists: false,
    });
  }

  return result;
}

function buildForYouSet(works: FeedItem[], recentArtists: string[]) {
  if (works.length === 0) return [];

  const recentArtistIds = new Set(recentArtists);
  const uniqueArtistCount = Math.max(1, countUniqueArtists(works));
  const maxArtistLimit = Math.max(
    DISCOVER_SET_SIZE,
    Math.ceil(DISCOVER_SET_SIZE / uniqueArtistCount) + 2,
  );
  const targetCount = Math.min(DISCOVER_SET_SIZE, works.length);

  let bestResult: FeedItem[] = [];

  for (let artistLimit = 1; artistLimit <= maxArtistLimit; artistLimit += 1) {
    const result = fillDiscoverQuota(
      works,
      recentArtistIds,
      artistLimit,
      targetCount,
    );

    if (result.length > bestResult.length) {
      bestResult = result;
    }

    if (result.length >= targetCount) {
      return shuffleWorks(result).slice(0, targetCount);
    }
  }

  addWorksFromPool({
    pool: works,
    result: bestResult,
    targetCount,
    artistLimit: DISCOVER_SET_SIZE,
    recentArtistIds,
    avoidRecentArtists: true,
  });

  addWorksFromPool({
    pool: works,
    result: bestResult,
    targetCount,
    artistLimit: DISCOVER_SET_SIZE,
    recentArtistIds,
    avoidRecentArtists: false,
  });

  return shuffleWorks(bestResult).slice(0, targetCount);
}

function buildDiscoverSet(
  works: FeedItem[],
  category: string,
  recentArtists: string[],
) {
  if (category === "DISCOVER") {
    return buildForYouSet(works, recentArtists);
  }

  return buildCategorySet(works, category, recentArtists);
}

function mergeUniqueWorks(
  current: FeedItem[],
  incoming: FeedItem[],
) {
  return Array.from(
    new Map(
      [
        ...current,
        ...incoming,
      ].map((work) => [
        work.id,
        work,
      ]),
    ).values(),
  );
}

export default function DiscoverFeed({ works }: DiscoverFeedProps) {
    const supabase = useMemo(
    () => createClient(),
    [],
    
  );

  const [
  pickPanelAddedCount,
  setPickPanelAddedCount,
] = useState(0);

const [
  pickPanelPulseKey,
  setPickPanelPulseKey,
] = useState(0);
const [
  pickPanelRefreshKey,
  setPickPanelRefreshKey,
] = useState(0);
  const [pendingPickWork, setPendingPickWork] =
  useState<FeedItem | null>(null);
  const [showLogin, setShowLogin] =
    useState(false);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("DISCOVER");
  const [
    candidateWorks,
    setCandidateWorks,
  ] = useState<FeedItem[]>(
    works,
  );
  const [displayWorks, setDisplayWorks] = useState<FeedItem[]>([]);
  const [selectedWork, setSelectedWork] = useState<FeedItem | null>(null);
  const [pickedWorkIds, setPickedWorkIds] = useState<Set<string>>(new Set());
  const [transitionStage, setTransitionStage] =
    useState<TransitionStage>("idle");

  const recentArtistsRef = useRef<string[]>([]);
  const shownWorkIdsRef =
    useRef<Set<string>>(
      new Set(),
    );
  const candidateWorksRef =
    useRef<FeedItem[]>(works);
  const pickedWorkIdsRef =
    useRef<Set<string>>(
      new Set(),
    );
  const candidateRoundsRef =
    useRef<
      Record<CandidateCategory, number>
    >({
      Music: 1,
      Dance: 1,
      Art: 1,
      Cosplay: 1,
    });
  const exhaustedCategoriesRef =
    useRef<
      Set<CandidateCategory>
    >(
      new Set(),
    );
  const workPageCycleRef =
    useRef<
      Partial<
        Record<
          CandidateCategory,
          WorkPageCycleState
        >
      >
    >({});
  const refillPromisesRef =
    useRef<
      Partial<
        Record<
          CandidateCategory,
          Promise<void>
        >
      >
    >({});
  const applyingSetRef =
    useRef(false);
  const feedTopRef = useRef<HTMLDivElement | null>(null);
  const masonryRef = useRef<HTMLDivElement | null>(null);

  const [
    masonryWidth,
    setMasonryWidth,
  ] = useState(0);

  const [
    imageRatios,
    setImageRatios,
  ] = useState<Record<string, number>>({});

  const columnCount =
    getResponsiveColumnCount(
      masonryWidth,
    );

  const columnWidth =
    columnCount > 0 &&
    masonryWidth > 0
      ? (
          masonryWidth -
          MASONRY_GAP *
            (columnCount - 1)
        ) /
        columnCount
      : 280;

  const balancedLayout =
    useMemo(
      () =>
        buildBalancedLayout(
          displayWorks,
          columnCount,
          columnWidth,
          imageRatios,
        ),
      [
        displayWorks,
        columnCount,
        columnWidth,
        imageRatios,
      ],
    );

  function getAvailableCandidates() {
    return candidateWorksRef.current.filter(
      (work) =>
        !pickedWorkIdsRef.current.has(
          work.id,
        ) &&
        !shownWorkIdsRef.current.has(
          work.id,
        ),
    );
  }

  function markWorksShown(
    nextSet: FeedItem[],
  ) {
    for (const work of nextSet) {
      shownWorkIdsRef.current.add(
        work.id,
      );
    }
  }

  async function refillCategory(
    category: CandidateCategory,
  ) {
    const existing =
      refillPromisesRef.current[
        category
      ];

    if (existing) {
      return existing;
    }

    const refillPromise =
      (async () => {
        const round =
          candidateRoundsRef.current[
            category
          ];

        const response = await fetch(
          `/api/discover/candidates?category=${encodeURIComponent(
            category,
          )}&round=${round}`,
        );

        if (!response.ok) {
          console.error(
            "REFILL DISCOVER CANDIDATES ERROR:",
            await response.text(),
          );

          return;
        }

        const data =
          (await response.json()) as CandidateBatchResponse;

        const incoming =
          Array.isArray(data.works)
            ? data.works
            : [];

        const artistPageCount =
          typeof data.artistPageCount ===
          "number"
            ? data.artistPageCount
            : 1;
        const artistPage =
          typeof data.artistPage ===
          "number"
            ? data.artistPage
            : 0;
        const workPage =
          typeof data.workPage ===
          "number"
            ? data.workPage
            : 0;

        updateWorkPageCycleExhaustion(
          category,
          artistPage,
          artistPageCount,
          workPage,
          incoming.length,
          workPageCycleRef,
          exhaustedCategoriesRef,
        );

        candidateRoundsRef.current[
          category
        ] =
          typeof data.nextRound ===
          "number"
            ? data.nextRound
            : round + 1;

        const merged =
          mergeUniqueWorks(
            candidateWorksRef.current,
            incoming,
          );

        candidateWorksRef.current =
          merged;

        setCandidateWorks(merged);
      })().finally(() => {
        delete refillPromisesRef.current[
          category
        ];
      });

    refillPromisesRef.current[
      category
    ] = refillPromise;

    return refillPromise;
  }

  async function ensureCandidatePool(
    category: string,
  ) {
    const targetCategories =
      category === "DISCOVER"
        ? candidateCategories
        : isValidDiscoverCategory(
              category,
            ) &&
            category !== "DISCOVER"
          ? [
              category as CandidateCategory,
            ]
          : [];

    const available =
      getAvailableCandidates();

    await Promise.all(
      targetCategories.map(
        async (targetCategory) => {
          const availableCount =
            available.filter(
              (work) =>
                normalizeCategory(
                  work.category,
                ) ===
                normalizeCategory(
                  targetCategory,
                ),
            ).length;

          if (
            availableCount <
              CANDIDATE_REFILL_THRESHOLD &&
            !exhaustedCategoriesRef.current.has(
              targetCategory,
            )
          ) {
            await refillCategory(
              targetCategory,
            );
          }
        },
      ),
    );
  }

  function recycleShownCandidates(
    category: string,
  ) {
    const currentIds = new Set(
      displayWorks.map(
        (work) => work.id,
      ),
    );

    for (
      const work of
        candidateWorksRef.current
    ) {
      const categoryMatches =
        category === "DISCOVER" ||
        normalizeCategory(
          work.category,
        ) ===
          normalizeCategory(
            category,
          );

      if (
        categoryMatches &&
        !currentIds.has(work.id)
      ) {
        shownWorkIdsRef.current.delete(
          work.id,
        );
      }
    }
  }

  function createNextSet(
    category: string,
  ) {
    let nextSet =
      buildDiscoverSet(
        getAvailableCandidates(),
        category,
        recentArtistsRef.current,
      );

    if (
      nextSet.length <
      DISCOVER_SET_SIZE
    ) {
      recycleShownCandidates(
        category,
      );

      nextSet = buildDiscoverSet(
        getAvailableCandidates(),
        category,
        recentArtistsRef.current,
      );
    }

    return nextSet;
  }

 async function applyNewSet(category: string, scrollToTop = false) {
  if (applyingSetRef.current) {
    return;
  }

  applyingSetRef.current = true;

  try {
    await ensureCandidatePool(
      category,
    );

    const nextSet = createNextSet(
      category,
    );

    setDisplayWorks(nextSet);
    markWorksShown(nextSet);
   

    const nextArtistIds = Array.from(
      new Set(nextSet.map((work) => work.artistId)),
    );

    recentArtistsRef.current = [
      ...recentArtistsRef.current,
      ...nextArtistIds,
    ].slice(-RECENT_ARTIST_HISTORY_LIMIT);

    if (scrollToTop) {
      requestAnimationFrame(() => {
        feedTopRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  } finally {
    applyingSetRef.current = false;
  }
  }

 useEffect(() => {
  async function initializeDiscover() {
    recentArtistsRef.current = [];
    shownWorkIdsRef.current =
      new Set();
    candidateWorksRef.current =
      works;
    setCandidateWorks(works);
    candidateRoundsRef.current = {
      Music: 1,
      Dance: 1,
      Art: 1,
      Cosplay: 1,
    };
    exhaustedCategoriesRef.current =
      new Set();
    refillPromisesRef.current = {};

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let loadedPickedIds =
      new Set<string>();

    if (user) {
      setCurrentUserId(user.id);

      const { data, error } =
        await supabase
          .from("work_picks")
          .select("work_id")
          .eq("user_id", user.id);

      if (error) {
        console.error(
          "LOAD PICKS ERROR:",
          error,
        );
      } else {
        loadedPickedIds =
          new Set(
            (data ?? []).map(
              (item) =>
                String(item.work_id),
            ),
          );

        setPickedWorkIds(
          loadedPickedIds,
        );
        pickedWorkIdsRef.current =
          loadedPickedIds;
      }
    } else {
      setCurrentUserId(null);
      setPickedWorkIds(
        new Set(),
      );
      pickedWorkIdsRef.current =
        new Set();
    }

    // 이미 Pick한 작품은 첫 화면에서도 제외
    const availableWorks =
      works.filter(
        (work) =>
          !loadedPickedIds.has(
            work.id,
          ),
      );

    const initialCategory =
      readStoredDiscoverCategory();

    const initialSet =
      buildDiscoverSet(
        availableWorks,
        initialCategory,
        [],
      );

    setSelectedCategory(
      initialCategory,
    );

    setDisplayWorks(
      initialSet,
    );
    markWorksShown(
      initialSet,
    );

    recentArtistsRef.current =
      Array.from(
        new Set(
          initialSet.map(
            (work) =>
              work.artistId,
          ),
        ),
      ).slice(
        -RECENT_ARTIST_HISTORY_LIMIT,
      );
  }

  initializeDiscover();
}, [works, supabase]);

  useEffect(() => {
    pickedWorkIdsRef.current =
      pickedWorkIds;
  }, [pickedWorkIds]);

  useEffect(() => {
    const container =
      masonryRef.current;

    if (!container) {
      return;
    }

    const updateWidth = () => {
      setMasonryWidth(
        container.getBoundingClientRect()
          .width,
      );
    };

    updateWidth();

    const observer =
      new ResizeObserver(
        updateWidth,
      );

    observer.observe(
      container,
    );

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!selectedWork) return;

    const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    setSelectedWork(null);

    setPickPanelRefreshKey(
      (current) => current + 1,
    );
  }
};

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedWork]);

  function handleCategoryClick(category: string) {
    if (
      transitionStage !== "idle" ||
      applyingSetRef.current
    ) {
      return;
    }

    setSelectedCategory(category);
    saveDiscoverCategory(category);
    void applyNewSet(
      category,
      false,
    );
  }

  function handleNext() {
  if (
    transitionStage !== "idle" ||
    applyingSetRef.current
  ) {
    return;
  }

  if (currentSetPickedCount > 0) {
  setPickPanelAddedCount(
    currentSetPickedCount,
  );

  setPickPanelPulseKey(
    (current) =>
      current + 1,
  );
}

  // 1. Pick하지 않은 카드 먼저 사라짐
  setTransitionStage("unpicked-out");

  // 2. Pick한 카드가 조금 늦게 사라짐
  window.setTimeout(() => {
    setTransitionStage("picked-out");
  }, 120);

  // 3. 모든 카드가 사라진 뒤 다음 Set 생성
  window.setTimeout(() => {
    void (async () => {
      applyingSetRef.current =
        true;

      try {
        await ensureCandidatePool(
          selectedCategory,
        );

        const nextSet =
          createNextSet(
            selectedCategory,
          );

        const nextArtistIds =
          Array.from(
            new Set(
              nextSet.map(
                (work) =>
                  work.artistId,
              ),
            ),
          );

        recentArtistsRef.current = [
          ...recentArtistsRef.current,
          ...nextArtistIds,
        ].slice(
          -RECENT_ARTIST_HISTORY_LIMIT,
        );

        setDisplayWorks(nextSet);
        markWorksShown(nextSet);
        setTransitionStage(
          "entering",
        );

        requestAnimationFrame(() => {
          feedTopRef.current?.scrollIntoView({
            behavior: "auto",
            block: "start",
          });
        });

        window.setTimeout(() => {
          setTransitionStage(
            "idle",
          );
        },240);
      } finally {
        applyingSetRef.current =
          false;
      }
    })();
  }, 30);
}


 async function togglePick(
  work: FeedItem,
) {
  let userId =
    currentUserId;

  // 평소 Pick에서는 currentUserId를 바로 사용.
  // 로그인 직후처럼 state 반영 전인 경우에만
  // Supabase Auth를 한 번 확인한다.
  if (!userId) {
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      setPendingPickWork(work);
      setShowLogin(true);
      return;
    }

    userId = user.id;
    setCurrentUserId(user.id);
  }

  const alreadyPicked =
    pickedWorkIds.has(
      work.id,
    );

  if (alreadyPicked) {
    // Optimistic UI:
    // Supabase 응답을 기다리지 않고
    // 화면에서 먼저 Pick 해제
    setPickedWorkIds(
      (current) => {
        const next =
          new Set(current);

        next.delete(
          work.id,
        );

        return next;
      },
    );

    const { error } =
      await supabase
        .from("work_picks")
        .delete()
        .eq(
          "user_id",
          userId,
        )
        .eq(
          "work_id",
          work.id,
        );

    if (error) {
      console.error(
        "REMOVE PICK ERROR:",
        error,
      );

      // 실패하면 원래 Pick 상태로 복구
      setPickedWorkIds(
        (current) => {
          const next =
            new Set(current);

          next.add(
            work.id,
          );

          return next;
        },
      );
    }

    return;
  }

  // Optimistic UI:
  // Supabase 응답을 기다리지 않고
  // 화면에서 먼저 Pick 처리
  setPickedWorkIds(
    (current) => {
      const next =
        new Set(current);

      next.add(
        work.id,
      );

      return next;
    },
  );

  const { error } =
    await supabase
      .from("work_picks")
      .insert({
        user_id:
          userId,

        work_id:
          work.id,

        artist_id:
          work.artistId,
      });

  if (error) {
    console.error(
      "SAVE PICK ERROR:",
      error,
    );

    // 저장 실패하면 Pick 상태 원복
    setPickedWorkIds(
      (current) => {
        const next =
          new Set(current);

        next.delete(
          work.id,
        );

        return next;
      },
    );
  }
}
function closeWorkModal() {
  setSelectedWork(null);

  setPickPanelRefreshKey(
    (current) => current + 1,
  );
}

function openPickedWork(
  pickedWork: Parameters<
    NonNullable<
      React.ComponentProps<
        typeof MyPicksPanel
      >["onWorkClick"]
    >
  >[0],
) {
  const workId = String(pickedWork.id);

  setPickedWorkIds((current) => {
    const next = new Set(current);
    next.add(workId);
    return next;
  });

  const work = candidateWorks.find(
    (item) =>
      String(item.id) === workId,
  );

  if (work) {
    setSelectedWork(work);
    return;
  }

  setSelectedWork({
    id: workId,
    artistId: pickedWork.artistId,
    artistName: pickedWork.artistName,
    category:
      pickedWork.category ?? "",
    type: pickedWork.type,
    image: pickedWork.image,
    videoId: pickedWork.videoId,
    caption: pickedWork.caption,
    sourceUrl: pickedWork.sourceUrl,
  });
}

  const currentSetPickedCount =
  displayWorks.filter((work) =>
    pickedWorkIds.has(work.id),
  ).length;

  const hasPicks =
  currentSetPickedCount > 0;

  function getCardTransitionClass(
  workId: string,
) {
  const picked =
    pickedWorkIds.has(workId);

  if (
    transitionStage ===
    "unpicked-out"
  ) {
    return picked
      ? "opacity-100 scale-[1.035] -translate-y-1"
      : "pointer-events-none opacity-100 scale-[0.96] translate-y-2";
  }

  if (
    transitionStage ===
    "picked-out"
  ) {
    return picked
      ? "pointer-events-none opacity-100 scale-[1.06] -translate-y-2"
      : "pointer-events-none opacity-100 scale-[0.96] translate-y-2";
  }

  if (
    transitionStage ===
    "entering"
  ) {
    return "pointer-events-none opacity-100 scale-100 translate-y-0";
  }

  return "opacity-100 scale-100 translate-y-0";
}

  return (
    <>
      <nav className="border-b border-gray-100 bg-white py-4">
        <div className="flex items-center gap-7 overflow-x-auto text-sm font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => {
            const active = selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => handleCategoryClick(category)}
                className={`shrink-0 cursor-pointer border-b-2 pb-2 transition ${
                  active
                    ? "border-fuchsia-600 text-fuchsia-600"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </nav>

      <div ref={feedTopRef} className="scroll-mt-6" />

      <div
        ref={masonryRef}
        className="mt-4 pb-24"//discover 밑단 여백 조정
      >
        {displayWorks.length > 0 ? (
          <div
            className="grid items-start"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              gap: `${MASONRY_GAP}px`,
            }}
          >
            {balancedLayout.columns.map(
              (column, columnIndex) => (
                <div
                  key={`column-${columnIndex}`}
                  className="flex min-w-0 flex-col"
                  style={{
                    gap: `${MASONRY_GAP}px`,
                  }}
                >
                  {column.map((work) => {
                    const isYoutube =
                      work.type ===
                        "youtube" &&
                      Boolean(
                        work.videoId,
                      );

                    const thumbnail =
                      getWorkThumbnail(
                        work,
                      );

                    const baseHeight =
                      estimateWorkHeight(
                        work,
                        columnWidth,
                        imageRatios,
                      );
                    const cardHeight =
                      Math.max(
                        180,
                        Math.round(
                          baseHeight,
                        ),
                      );

                    return (
                      <div
                        key={work.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setSelectedWork(
                            work,
                          )
                        }
                        onKeyDown={(
                          event,
                        ) => {
                          if (
                            event.key ===
                              "Enter" ||
                            event.key ===
                              " "
                          ) {
                            setSelectedWork(
                              work,
                            );
                          }
                        }}
                        className={`group block w-full cursor-pointer text-left transition-all ease-out ${
                          transitionStage === "unpicked-out" &&
                          !pickedWorkIds.has(work.id)
                            ? "duration-200"
                            : transitionStage === "picked-out"
                              ? "duration-300"
                              : transitionStage === "entering"
                                ? "duration-300"
                                : "duration-300"
                        } ${getCardTransitionClass(work.id)}`}
                      >
                        <article
                          className={`relative rounded-2xl transition-all duration-300 ${
                            pickedWorkIds.has(work.id)
                              ? "bg-gradient-to-br from-fuchsia-500 via-purple-500 to-pink-500 p-[3px] shadow-[0_0_0_1px_rgba(217,70,239,0.15),0_8px_28px_rgba(217,70,239,0.28)]"
                              : "bg-gray-100"
                          }`}
                        >
                          <div
                            className="relative w-full overflow-hidden rounded-[13px] bg-neutral-950"
                            style={{
                              height: `${cardHeight}px`,
                            }}
                          >
                            {thumbnail ? (
                              <img
                                src={
                                  thumbnail
                                }
                                alt={
                                  isYoutube
                                    ? `${work.artistName} video`
                                    : `${work.artistName} work`
                                }
                                draggable={
                                  false
                                }
                                onLoad={(
                                  event,
                                ) => {
                                  if (
                                    isYoutube
                                  ) {
                                    return;
                                  }

                                  const image =
                                    event.currentTarget;

                                  if (
                                    !image.naturalWidth ||
                                    !image.naturalHeight
                                  ) {
                                    return;
                                  }

                                  const nextRatio =
                                    image.naturalWidth /
                                    image.naturalHeight;

                                  setImageRatios(
                                    (current) => {
                                      if (
                                        Math.abs(
                                          (current[
                                            work.id
                                          ] ?? 0) -
                                            nextRatio,
                                        ) <
                                        0.001
                                      ) {
                                        return current;
                                      }

                                      return {
                                        ...current,
                                        [work.id]:
                                          nextRatio,
                                      };
                                    },
                                  );
                                }}
                                className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.02]"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm text-white/30">
                                No thumbnail
                              </div>
                            )}

                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/75 via-black/25 to-transparent transition duration-300 group-hover:from-black/80" />

                            {isYoutube && (
                              <div className="pointer-events-none absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-[11px] text-white/90 backdrop-blur-[2px] transition duration-300 group-hover:bg-black/65 group-hover:text-white">
                                ▶
                              </div>
                            )}

                            {pickedWorkIds.has(work.id) && (
                              <div className="pointer-events-none absolute left-3 top-3 flex h-8 items-center justify-center gap-1 rounded-full bg-fuchsia-600 px-3 text-[11px] font-bold text-white shadow-lg">
                                <span aria-hidden="true">✓</span>
                                Picked
                              </div>
                            )}

                            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
                                {
                                  work.category
                                }
                              </p>

                              <h2 className="mt-1 line-clamp-1 text-base font-bold tracking-tight text-white">
                                {
                                  work.artistName
                                }
                              </h2>
                            </div>
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No works in this category yet.
          </p>
        )}
      </div>

{displayWorks.length > 0 && (     //pass바 크기조정
  <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/80 py-1.5 backdrop-blur-md">
  <div className="relative flex items-center justify-center">
    {hasPicks ? (
      <span className="absolute right-[calc(50%+91px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-semibold tracking-wide text-fuchsia-600">
        Picked {currentSetPickedCount}
      </span>
    ) : (
      <span className="absolute right-[calc(50%+91px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-semibold tracking-wide text-gray-800">
        Pick or
      </span>
    )}

    <button
      type="button"
      onClick={handleNext}
      disabled={transitionStage !== "idle"}
      className={`group inline-flex h-11 min-w-[150px] items-center justify-center rounded-full px-8 text-base font-bold transition-all duration-300 disabled:cursor-default ${
        hasPicks
          ? "border border-fuchsia-600 bg-fuchsia-600 text-white shadow-[0_6px_16px_rgba(192,38,211,0.24)] hover:bg-fuchsia-700"
          : "border border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50"
      }`}
    >
      {hasPicks ? "Next" : "Pass"}
    </button>
  </div>
</div>
)}
<MyPicksPanel
  addedCount={pickPanelAddedCount}
  pulseKey={pickPanelPulseKey}
  refreshKey={pickPanelRefreshKey}
  works={candidateWorks}
  onWorkClick={openPickedWork}
/>
      {selectedWork && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={closeWorkModal}
        >
          <div
            className="relative flex max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex min-w-0 flex-1 items-center justify-center bg-neutral-900">
              {selectedWork.type === "youtube" && selectedWork.videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${selectedWork.videoId}?autoplay=1&rel=0`}
                  title={`${selectedWork.artistName} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="aspect-[9/16] max-h-[80vh] w-full"
                />
              ) : (
                <img
                  src={selectedWork.image}
                  alt={`${selectedWork.artistName} work`}
                  draggable={false}
                  className="max-h-[80vh] w-full object-contain"
                />
              )}
            </div>
            <aside className="relative w-[300px] shrink-0 bg-white p-6">
              <button
                type="button"
                onClick={closeWorkModal}
                aria-label="Close work"
                className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 transition hover:bg-gray-200 hover:text-gray-950"
              >
                ×
              </button>

              <div className="pr-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-600">
                  {selectedWork.category}
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                  {selectedWork.artistName}
                </h2>
              </div>

              {selectedWork.caption && (
                <p className="mt-5 line-clamp-[8] text-sm leading-6 text-gray-600">
                  {selectedWork.caption}
                </p>
              )}

              <button
                type="button"
                onClick={() => togglePick(selectedWork)}
                className={`mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-bold transition ${
                  pickedWorkIds.has(selectedWork.id)
                    ? "border-fuchsia-600 bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                    : "border-gray-200 bg-white text-gray-800 hover:border-fuchsia-200 hover:text-fuchsia-600"
                }`}
              >
                <span aria-hidden="true">
                  {pickedWorkIds.has(selectedWork.id) ? "✓" : "+"}
                </span>
                {pickedWorkIds.has(selectedWork.id) ? "Picked" : "Pick"}
              </button>

              <Link
                href={`/creator/${selectedWork.artistId}`}
                className="mt-3 flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-gray-950 px-5 text-sm font-bold text-white transition hover:bg-gray-800"
              >
                View Artist Profile
              </Link>
            </aside>
          </div>
        </div>
      )}

      <AuthModal
        open={showLogin}
        onClose={() =>
          setShowLogin(false)
        }
        onSuccess={async () => {
          if (!pendingPickWork) {
            return;
          }

          const workToPick =
            pendingPickWork;

          setPendingPickWork(null);

          await togglePick(
            workToPick,
          );
        }}
      />
    </>
  );
}