"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { FeedItem } from "@/components/discover/DiscoverFeed";

const PAGE_SIZE = 36;

type RecentResponse = {
  works?: FeedItem[];
  nextPage?: number;
  hasMore?: boolean;
};

async function fetchRecentPage(
  categorySignature: string,
  page: number,
  subjectId: string,
) {
  const params = new URLSearchParams({
    page: String(page),
  });

  if (categorySignature !== "all") {
    params.set("categories", categorySignature);
  }

  if (subjectId) {
    params.set("subjectId", subjectId);
  }

  const response = await fetch(
    `/api/discover/recent?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as RecentResponse;
}

export function useRecentDiscoverFeed(
  categorySignature: string,
  pickedWorkIds: Set<string>,
  picksReady: boolean,
  enabled: boolean,
  subjectId = "",
) {
  const [works, setWorks] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const appendingRef = useRef(false);
  const generationRef = useRef(0);
  const pickedWorkIdsRef = useRef(pickedWorkIds);

  pickedWorkIdsRef.current = pickedWorkIds;

  const loadPage = useCallback(
    async (
      page: number,
      generation: number,
    ) => {
      const data = await fetchRecentPage(
        categorySignature,
        page,
        subjectId,
      );

      if (generation !== generationRef.current) {
        return [] as FeedItem[];
      }

      pageRef.current =
        typeof data.nextPage === "number"
          ? data.nextPage
          : page + 1;
      hasMoreRef.current = data.hasMore !== false;

      const incoming = Array.isArray(data.works)
        ? data.works
        : [];

      return incoming.filter(
        (work) => !pickedWorkIdsRef.current.has(work.id),
      );
    },
    [categorySignature, subjectId],
  );

  useEffect(() => {
    if (!enabled || !picksReady) {
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    pageRef.current = 0;
    hasMoreRef.current = true;
    appendingRef.current = false;
    setWorks([]);
    setIsLoading(true);
    setIsLoadingMore(false);

    void (async () => {
      try {
        const initial = await loadPage(0, generation);

        if (generation === generationRef.current) {
          setWorks(initial);
        }
      } catch (error) {
        console.error("LOAD RECENT FEED ERROR:", error);
      } finally {
        if (generation === generationRef.current) {
          setIsLoading(false);
        }
      }
    })();
  }, [enabled, loadPage, picksReady]);

  const appendNextBatch = useCallback(async () => {
    if (
      !enabled ||
      isLoading ||
      appendingRef.current ||
      !hasMoreRef.current
    ) {
      return;
    }

    appendingRef.current = true;
    setIsLoadingMore(true);
    const generation = generationRef.current;

    try {
      const next = await loadPage(
        pageRef.current,
        generation,
      );

      if (
        generation !== generationRef.current ||
        next.length === 0
      ) {
        return;
      }

      setWorks((current) => {
        const existing = new Set(
          current.map((work) => work.id),
        );
        const unique = next.filter(
          (work) => !existing.has(work.id),
        );

        return unique.length > 0
          ? [...current, ...unique]
          : current;
      });
    } catch (error) {
      console.error("APPEND RECENT FEED ERROR:", error);
    } finally {
      appendingRef.current = false;

      if (generation === generationRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [enabled, isLoading, loadPage]);

  const prune = useCallback((workIds: string[]) => {
    if (workIds.length === 0) {
      return;
    }

    const removed = new Set(workIds);

    setWorks((current) =>
      current.filter(
        (work) => !removed.has(work.feedKey ?? work.id),
      ),
    );
  }, []);

  const removePickedWork = useCallback((workId: string) => {
    setWorks((current) =>
      current.filter((work) => work.id !== workId),
    );
  }, []);

  return {
    works,
    isLoading,
    isLoadingMore,
    appendNextBatch,
    prune,
    removePickedWork,
    pageSize: PAGE_SIZE,
  };
}
