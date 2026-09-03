"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { FeedItem } from "@/components/discover/DiscoverFeed";
import {
  parseDiscoverCategoriesParam,
  workMatchesDiscoverCategories,
} from "@/lib/discover/discoverCategorySelection";
import type { CreatorCategory } from "@/lib/creator/creatorCategories";
import {
  DISCOVER_ARTIST_HISTORY_LIMIT,
  selectDiscoverWorks,
} from "@/lib/discover/selectDiscoverWorks";

const INITIAL_FEED_SIZE = 12;
const APPEND_BATCH_SIZE = 12;
const MAX_PAGES_PER_FILL = 16;
const RECENT_SEEN_LIMIT = 48;
const SEEDED_START_ROUND = 1;
const INITIAL_DISCOVER_MIX_PAGES = 3;
const APPEND_DISCOVER_FRESH_PAGES = 1;
const MAX_CANDIDATE_BUFFER_SIZE = 144;

function createFeedSeed() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

type CandidateBatchResponse = {
  works?: FeedItem[];
  nextRound?: number;
  artistPageCount?: number;
  workPage?: number;
};

function resolveCategoriesFromSignature(
  categorySignature: string,
): CreatorCategory[] | null {
  if (categorySignature === "all") {
    return null;
  }

  return parseDiscoverCategoriesParam(categorySignature);
}

function artistIdForHistory(work: FeedItem) {
  if (typeof work.artistId !== "string") {
    return null;
  }

  const trimmed = work.artistId.trim();
  return trimmed || null;
}

async function fetchCategoryBatch(
  categorySignature: string,
  round: number,
  searchQuery: string,
  seed: string,
  subjectId: string,
) {
  const params = new URLSearchParams({
    round: String(round),
  });

  if (seed) {
    params.set("seed", seed);
  }

  if (categorySignature !== "all") {
    params.set("categories", categorySignature);
  }

  if (searchQuery) {
    params.set("q", searchQuery);
  } else if (subjectId) {
    params.set("subjectId", subjectId);
  }

  const response = await fetch(
    `/api/discover/candidates?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as CandidateBatchResponse;
}

export function useDiscoverFeed(
  categorySignature: string,
  pickedWorkIds: Set<string>,
  picksReady: boolean,
  searchQuery = "",
  subjectId = "",
) {
  const normalizedSearch = searchQuery.trim();
  const isSearchMode = normalizedSearch.length > 0;
  const isSubjectMode = !isSearchMode && subjectId.length > 0;
  const [works, setWorks] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const worksRef = useRef<FeedItem[]>([]);
  const candidateBufferRef = useRef<FeedItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const recentIdsRef = useRef<string[]>([]);
  const recentArtistIdsRef = useRef<string[]>([]);
  const feedSeedRef = useRef(createFeedSeed());
  const roundRef = useRef(SEEDED_START_ROUND);
  const appendingRef = useRef(false);
  const generationRef = useRef(0);
  const emptyPageStreakRef = useRef(0);
  const pickedWorkIdsRef = useRef(pickedWorkIds);
  const searchResultCacheRef = useRef<FeedItem[]>([]);
  const searchCacheIdsRef = useRef<Set<string>>(new Set());
  const searchFetchedPagesRef = useRef<Set<number>>(new Set());
  const searchExhaustedRef = useRef(false);
  const searchLoopCursorRef = useRef(0);
  const searchLoopSeqRef = useRef(0);

  worksRef.current = works;
  pickedWorkIdsRef.current = pickedWorkIds;

  const rememberSelectedWorks = useCallback((batch: FeedItem[]) => {
    for (const work of batch) {
      seenIdsRef.current.add(work.id);
    }

    recentIdsRef.current = [
      ...recentIdsRef.current,
      ...batch.map((work) => work.id),
    ].slice(-RECENT_SEEN_LIMIT);

    const selectedArtistIds = batch
      .map(artistIdForHistory)
      .filter((artistId): artistId is string => Boolean(artistId));

    recentArtistIdsRef.current = [
      ...recentArtistIdsRef.current,
      ...selectedArtistIds,
    ].slice(-DISCOVER_ARTIST_HISTORY_LIMIT);
  }, []);

  const resetSearchLoopState = useCallback(() => {
    searchResultCacheRef.current = [];
    searchCacheIdsRef.current = new Set();
    searchFetchedPagesRef.current = new Set();
    searchExhaustedRef.current = false;
    searchLoopCursorRef.current = 0;
    searchLoopSeqRef.current = 0;
  }, []);

  const rememberSearchResults = useCallback(
    (incoming: FeedItem[], categories: CreatorCategory[] | null) => {
      let newUnique = 0;

      for (const work of incoming) {
        if (
          !workMatchesDiscoverCategories(work, categories) ||
          pickedWorkIdsRef.current.has(work.id) ||
          searchCacheIdsRef.current.has(work.id)
        ) {
          continue;
        }

        searchCacheIdsRef.current.add(work.id);
        searchResultCacheRef.current.push(work);
        newUnique += 1;
      }

      return newUnique;
    },
    [],
  );

  const takeFromSearchLoop = useCallback((needed: number) => {
    const cache = searchResultCacheRef.current;

    if (cache.length === 0 || needed <= 0) {
      return [] as FeedItem[];
    }

    const selected: FeedItem[] = [];
    const maxScans = cache.length * needed;
    let scanned = 0;

    while (selected.length < needed && scanned < maxScans) {
      const index =
        searchLoopCursorRef.current % cache.length;
      searchLoopCursorRef.current = index + 1;
      scanned += 1;

      const work = cache[index];

      if (pickedWorkIdsRef.current.has(work.id)) {
        continue;
      }

      searchLoopSeqRef.current += 1;
      selected.push({
        ...work,
        feedKey: `${work.id}#${searchLoopSeqRef.current}`,
      });
    }

    return selected;
  }, []);

  const isSearchLoopReady = useCallback(() => {
    if (
      !searchExhaustedRef.current ||
      searchResultCacheRef.current.length === 0 ||
      candidateBufferRef.current.length > 0
    ) {
      return false;
    }

    return searchResultCacheRef.current.every(
      (work) =>
        seenIdsRef.current.has(work.id) ||
        pickedWorkIdsRef.current.has(work.id),
    );
  }, []);

  const collectBatch = useCallback(
    async (
      signatureToLoad: string,
      needed: number,
      generation: number,
      queryToLoad: string,
      subjectIdToLoad: string,
      minimumFreshPages = 0,
    ) => {
      const categories = resolveCategoriesFromSignature(
        signatureToLoad,
      );
      const searchMode = queryToLoad.trim().length > 0;
      const subjectMode =
        !searchMode && subjectIdToLoad.length > 0;
      const normalDiscoverMode = !searchMode && !subjectMode;

      const isUsableCandidate = (work: FeedItem) =>
        workMatchesDiscoverCategories(work, categories) &&
        !pickedWorkIdsRef.current.has(work.id) &&
        !seenIdsRef.current.has(work.id);

      candidateBufferRef.current =
        candidateBufferRef.current.filter(isUsableCandidate);

      let pagesTried = 0;
      const freshPageTarget = normalDiscoverMode
        ? Math.max(0, Math.floor(minimumFreshPages))
        : 0;

      while (
        (candidateBufferRef.current.length < needed ||
          pagesTried < freshPageTarget) &&
        pagesTried < MAX_PAGES_PER_FILL &&
        !(searchMode && searchExhaustedRef.current)
      ) {
        const data = await fetchCategoryBatch(
          signatureToLoad,
          roundRef.current,
          queryToLoad,
          normalDiscoverMode ? feedSeedRef.current : "",
          searchMode ? "" : subjectIdToLoad,
        );

        if (generation !== generationRef.current) {
          return [];
        }

        roundRef.current =
          typeof data.nextRound === "number"
            ? data.nextRound
            : roundRef.current + 1;
        pagesTried += 1;

        const incoming = Array.isArray(data.works)
          ? data.works
          : [];
        const recentSet = new Set(recentIdsRef.current);
        const bufferIds = new Set(
          candidateBufferRef.current.map((work) => work.id),
        );

        if (searchMode) {
          rememberSearchResults(incoming, categories);

          const pageCount =
            typeof data.artistPageCount === "number"
              ? data.artistPageCount
              : null;

          if (typeof data.workPage === "number") {
            if (searchFetchedPagesRef.current.has(data.workPage)) {
              searchExhaustedRef.current = true;
            } else {
              searchFetchedPagesRef.current.add(data.workPage);
            }
          }

          if (
            incoming.length === 0 ||
            (pageCount !== null &&
              searchFetchedPagesRef.current.size >= pageCount)
          ) {
            searchExhaustedRef.current = true;
          }
        }

        const matches = incoming.filter(
          (work) =>
            isUsableCandidate(work) &&
            !recentSet.has(work.id) &&
            !bufferIds.has(work.id),
        );

        if (matches.length === 0) {
          emptyPageStreakRef.current += 1;
        } else {
          emptyPageStreakRef.current = 0;
          candidateBufferRef.current.push(...matches);
        }

        if (subjectMode && emptyPageStreakRef.current >= 2) {
          break;
        }

        if (!searchMode && emptyPageStreakRef.current >= 6) {
          if (subjectMode) {
            break;
          }

          seenIdsRef.current = new Set(
            worksRef.current.map((work) => work.id),
          );
          emptyPageStreakRef.current = 0;
          candidateBufferRef.current =
            candidateBufferRef.current.filter(isUsableCandidate);
        }
      }

      const { selected, remaining } = selectDiscoverWorks(
        candidateBufferRef.current,
        needed,
        recentArtistIdsRef.current,
      );

      candidateBufferRef.current =
        remaining.length > MAX_CANDIDATE_BUFFER_SIZE
          ? remaining.slice(-MAX_CANDIDATE_BUFFER_SIZE)
          : remaining;
      rememberSelectedWorks(selected);

      return selected;
    },
    [rememberSearchResults, rememberSelectedWorks],
  );

  useEffect(() => {
    if (!picksReady) {
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    candidateBufferRef.current = [];
    seenIdsRef.current = new Set();
    recentIdsRef.current = [];
    recentArtistIdsRef.current = [];
    roundRef.current =
      isSearchMode || isSubjectMode
        ? 0
        : SEEDED_START_ROUND;
    emptyPageStreakRef.current = 0;
    appendingRef.current = false;
    resetSearchLoopState();
    setWorks([]);
    setIsLoading(true);
    setIsLoadingMore(false);

    void (async () => {
      try {
        const initial = await collectBatch(
          categorySignature,
          INITIAL_FEED_SIZE,
          generation,
          normalizedSearch,
          subjectId,
          isSearchMode || isSubjectMode
            ? 0
            : INITIAL_DISCOVER_MIX_PAGES,
        );

        if (generation !== generationRef.current) {
          return;
        }

        setWorks(initial);
      } catch (error) {
        console.error(
          "LOAD DISCOVER FEED ERROR:",
          categorySignature,
          error,
        );
      } finally {
        if (generation === generationRef.current) {
          setIsLoading(false);
        }
      }
    })();
  }, [categorySignature, collectBatch, isSearchMode, isSubjectMode, normalizedSearch, picksReady, resetSearchLoopState, subjectId]);

  const appendNextBatch = useCallback(async () => {
    if (appendingRef.current || isLoading) {
      return;
    }

    appendingRef.current = true;
    const generation = generationRef.current;
    const canLoopSearch = isSearchMode && isSearchLoopReady();

    if (canLoopSearch) {
      try {
        const nextWorks = takeFromSearchLoop(APPEND_BATCH_SIZE);

        if (
          generation !== generationRef.current ||
          nextWorks.length === 0
        ) {
          return;
        }

        setWorks((current) => [...current, ...nextWorks]);
      } finally {
        appendingRef.current = false;
      }

      return;
    }

    setIsLoadingMore(true);

    try {
      let nextWorks = await collectBatch(
        categorySignature,
        APPEND_BATCH_SIZE,
        generation,
        normalizedSearch,
        subjectId,
        isSearchMode || isSubjectMode
          ? 0
          : APPEND_DISCOVER_FRESH_PAGES,
      );

      if (generation !== generationRef.current) {
        return;
      }

      if (
        nextWorks.length === 0 &&
        isSearchMode &&
        isSearchLoopReady()
      ) {
        nextWorks = takeFromSearchLoop(APPEND_BATCH_SIZE);
      }

      if (nextWorks.length === 0) {
        return;
      }

      const isLoopBatch = nextWorks.some((work) =>
        Boolean(work.feedKey),
      );

      setWorks((current) => {
        if (isLoopBatch) {
          return [...current, ...nextWorks];
        }

        const existing = new Set(current.map((work) => work.id));
        const unique = nextWorks.filter(
          (work) => !existing.has(work.id),
        );

        if (unique.length === 0) {
          return current;
        }

        return [...current, ...unique];
      });
    } catch (error) {
      console.error(
        "APPEND DISCOVER FEED ERROR:",
        categorySignature,
        error,
      );
    } finally {
      appendingRef.current = false;

      if (generation === generationRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [
    categorySignature,
    collectBatch,
    isLoading,
    isSearchMode,
    isSearchLoopReady,
    isSubjectMode,
    normalizedSearch,
    subjectId,
    takeFromSearchLoop,
  ]);

  const removePickedWork = useCallback((workId: string) => {
    seenIdsRef.current.add(workId);
    candidateBufferRef.current = candidateBufferRef.current.filter(
      (work) => work.id !== workId,
    );
    searchResultCacheRef.current = searchResultCacheRef.current.filter(
      (work) => work.id !== workId,
    );
    searchCacheIdsRef.current.delete(workId);

    setWorks((current) =>
      current.filter((work) => work.id !== workId),
    );
  }, []);

  const prune = useCallback((workIds: string[]) => {
    if (workIds.length === 0) {
      return;
    }

    const removed = new Set(workIds);

    setWorks((current) => {
      const next = current.filter(
        (work) => !removed.has(work.feedKey ?? work.id),
      );

      return next.length === current.length ? current : next;
    });
  }, []);

  return {
    works,
    isLoading,
    isLoadingMore,
    appendNextBatch,
    prune,
    removePickedWork,
  };
}
