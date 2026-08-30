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
) {
  const params = new URLSearchParams({
    round: String(round),
    seed,
  });

  if (categorySignature !== "all") {
    params.set("categories", categorySignature);
  }

  if (searchQuery) {
    params.set("q", searchQuery);
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
) {
  const normalizedSearch = searchQuery.trim();
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

  const collectBatch = useCallback(
    async (
      signatureToLoad: string,
      needed: number,
      generation: number,
      queryToLoad: string,
    ) => {
      const categories = resolveCategoriesFromSignature(
        signatureToLoad,
      );

      const isUsableCandidate = (work: FeedItem) =>
        workMatchesDiscoverCategories(work, categories) &&
        !pickedWorkIdsRef.current.has(work.id) &&
        !seenIdsRef.current.has(work.id);

      candidateBufferRef.current =
        candidateBufferRef.current.filter(isUsableCandidate);

      let pagesTried = 0;

      while (
        candidateBufferRef.current.length < needed &&
        pagesTried < MAX_PAGES_PER_FILL
      ) {
        const data = await fetchCategoryBatch(
          signatureToLoad,
          roundRef.current,
          queryToLoad,
          feedSeedRef.current,
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

        if (emptyPageStreakRef.current >= 6) {
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

      candidateBufferRef.current = remaining;
      rememberSelectedWorks(selected);

      return selected;
    },
    [rememberSelectedWorks],
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
    roundRef.current = SEEDED_START_ROUND;
    emptyPageStreakRef.current = 0;
    appendingRef.current = false;
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
  }, [categorySignature, collectBatch, normalizedSearch, picksReady]);

  const appendNextBatch = useCallback(async () => {
    if (appendingRef.current || isLoading) {
      return;
    }

    appendingRef.current = true;
    setIsLoadingMore(true);
    const generation = generationRef.current;

    try {
      const nextWorks = await collectBatch(
        categorySignature,
        APPEND_BATCH_SIZE,
        generation,
        normalizedSearch,
      );

      if (
        generation !== generationRef.current ||
        nextWorks.length === 0
      ) {
        return;
      }

      setWorks((current) => {
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
  }, [categorySignature, collectBatch, isLoading, normalizedSearch]);

  const removePickedWork = useCallback((workId: string) => {
    seenIdsRef.current.add(workId);
    candidateBufferRef.current = candidateBufferRef.current.filter(
      (work) => work.id !== workId,
    );

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
      const next = current.filter((work) => !removed.has(work.id));

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
