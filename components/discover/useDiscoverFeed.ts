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



const INITIAL_FEED_SIZE = 12;

const APPEND_BATCH_SIZE = 12;

const MAX_PAGES_PER_FILL = 16;

const RECENT_SEEN_LIMIT = 48;



type CandidateBatchResponse = {

  works?: FeedItem[];

  nextRound?: number;

};



function shuffleWorks(works: FeedItem[]) {

  const shuffled = [...works];



  for (let i = shuffled.length - 1; i > 0; i -= 1) {

    const randomIndex = Math.floor(

      Math.random() * (i + 1),

    );

    [shuffled[i], shuffled[randomIndex]] = [

      shuffled[randomIndex],

      shuffled[i],

    ];

  }



  return shuffled;

}



function resolveCategoriesFromSignature(

  categorySignature: string,

): CreatorCategory[] | null {

  if (categorySignature === "all") {

    return null;

  }



  return parseDiscoverCategoriesParam(

    categorySignature,

  );

}



async function fetchCategoryBatch(

  categorySignature: string,

  round: number,

) {

  const params = new URLSearchParams({

    round: String(round),

  });



  if (categorySignature !== "all") {

    params.set("categories", categorySignature);

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

) {

  const [works, setWorks] = useState<FeedItem[]>(

    [],

  );

  const [isLoading, setIsLoading] =

    useState(true);

  const [isLoadingMore, setIsLoadingMore] =

    useState(false);



  const worksRef = useRef<FeedItem[]>([]);

  const seenIdsRef = useRef<Set<string>>(

    new Set(),

  );

  const recentIdsRef = useRef<string[]>([]);

  const roundRef = useRef(0);

  const appendingRef = useRef(false);

  const generationRef = useRef(0);

  const emptyPageStreakRef = useRef(0);



  worksRef.current = works;



  const rememberWorks = useCallback(

    (batch: FeedItem[]) => {

      for (const work of batch) {

        seenIdsRef.current.add(work.id);

      }



      recentIdsRef.current = [

        ...recentIdsRef.current,

        ...batch.map((work) => work.id),

      ].slice(-RECENT_SEEN_LIMIT);

    },

    [],

  );



  const collectBatch = useCallback(

    async (

      signatureToLoad: string,

      needed: number,

      generation: number,

    ) => {

      const categories =

        resolveCategoriesFromSignature(

          signatureToLoad,

        );

      const collected: FeedItem[] = [];

      const recentSet = new Set(

        recentIdsRef.current,

      );

      let pagesTried = 0;



      while (

        collected.length < needed &&

        pagesTried < MAX_PAGES_PER_FILL

      ) {

        const data = await fetchCategoryBatch(

          signatureToLoad,

          roundRef.current,

        );



        if (generation !== generationRef.current) {

          return collected;

        }



        roundRef.current =

          typeof data.nextRound === "number"

            ? data.nextRound

            : roundRef.current + 1;

        pagesTried += 1;



        const incoming = Array.isArray(data.works)

          ? data.works

          : [];

        const matches = shuffleWorks(

          incoming.filter(

            (work) =>

              workMatchesDiscoverCategories(

                work,

                categories,

              ) &&

              !seenIdsRef.current.has(work.id) &&

              !recentSet.has(work.id) &&

              !collected.some(

                (item) => item.id === work.id,

              ),

          ),

        );



        if (matches.length === 0) {

          emptyPageStreakRef.current += 1;

        } else {

          emptyPageStreakRef.current = 0;

          collected.push(...matches);

        }



        if (emptyPageStreakRef.current >= 6) {

          seenIdsRef.current = new Set([

            ...worksRef.current.map((work) => work.id),

            ...collected.map((work) => work.id),

          ]);

          emptyPageStreakRef.current = 0;

        }

      }



      rememberWorks(collected);



      return collected.slice(0, needed);

    },

    [rememberWorks],

  );



  useEffect(() => {

    const generation = generationRef.current + 1;

    generationRef.current = generation;

    seenIdsRef.current = new Set();

    recentIdsRef.current = [];

    roundRef.current = 0;

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

  }, [categorySignature, collectBatch]);



  const appendNextBatch = useCallback(async () => {

    if (

      appendingRef.current ||

      isLoading

    ) {

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

      );



      if (

        generation !== generationRef.current ||

        nextWorks.length === 0

      ) {

        return;

      }



      setWorks((current) => {

        const existing = new Set(

          current.map((work) => work.id),

        );

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

  }, [categorySignature, collectBatch, isLoading]);



  const prune = useCallback((workIds: string[]) => {

    if (workIds.length === 0) {

      return;

    }



    const removed = new Set(workIds);



    setWorks((current) => {

      const next = current.filter(

        (work) => !removed.has(work.id),

      );



      return next.length === current.length

        ? current

        : next;

    });

  }, []);



  return {

    works,

    isLoading,

    isLoadingMore,

    appendNextBatch,

    prune,

  };

}

