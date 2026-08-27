import { createClient } from "@/lib/supabase/server";



import type { FeedItem } from "@/components/discover/DiscoverFeed";

import {
  buildEffectiveCategoryOrFilter,
  workMatchesDiscoverCategories,
} from "@/lib/discover/discoverCategorySelection";
import type { CreatorCategory } from "@/lib/creator/creatorCategories";

import {

  DISCOVER_TYPES,

  type DiscoverType,

} from "@/lib/discover/discoverTypes";



export {

  DISCOVER_TYPES,

  DISCOVER_TYPE_TO_TAG,

  discoverTypesToTags,

  getTypesSignature,

  isDiscoverType,

  parseDiscoverTypesParam,

  type DiscoverType,

} from "@/lib/discover/discoverTypes";



const WORKS_PER_BATCH = 36;



type WorkRow = {

  id: number;

  type: string;

  source: string;

  source_id: string | null;

  source_url: string;

  title: string | null;

  description: string | null;

  thumbnail_url: string | null;

  published_at: string | null;

  duration_seconds: number | null;

  discover_category: string | null;

};



type CreatorRow = {

  id: string;

  name: string;

  category: string;

  tags: string[] | null;

};



type WorkWithCreator = WorkRow & {

  artist:

    | CreatorRow

    | CreatorRow[]

    | null;

};



export type DiscoverCandidateBatch = {

  works: FeedItem[];

  nextRound: number;

  /** @deprecated clip-first: work page count (kept for client compat) */

  artistPageCount: number;

  /** @deprecated clip-first: work page index (kept for client compat) */

  artistPage: number;

  workPage: number;

};



export function normalizeDiscoverSearchQuery(
  query: string | null | undefined,
): string | null {
  const trimmed = query?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function escapePostgrestIlikeValue(
  value: string,
): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function applyDiscoverSearchFilter<
  T extends {
    or: (
      filters: string,
      options?: {
        foreignTable?: string;
      },
    ) => T;
  },
>(
  query: T,
  searchQuery: string | null,
): T {
  if (!searchQuery) {
    return query;
  }

  const pattern = `%${escapePostgrestIlikeValue(searchQuery)}%`;

  return query.or(
    `title.ilike."${pattern}",description.ilike."${pattern}"`,
  );
}



function resolveCreator(

  artist:

    | CreatorRow

    | CreatorRow[]

    | null,

): CreatorRow | null {

  if (!artist) {

    return null;

  }



  return Array.isArray(artist)

    ? artist[0] ?? null

    : artist;

}



function isDisplayableWork(

  work: WorkRow,

) {

  if (

    work.source === "youtube" ||

    work.source === "tiktok"

  ) {

    return Boolean(work.source_id);

  }



  return Boolean(

    work.thumbnail_url?.trim() ||

      work.source_url?.trim(),

  );

}



function resolveDurationSeconds(
  work: WorkRow,
): number | undefined {
  if (
    typeof work.duration_seconds !==
      "number" ||
    work.duration_seconds <= 0
  ) {
    return undefined;
  }

  return work.duration_seconds;
}



function resolveEffectiveCategory(
  work: Pick<WorkRow, "discover_category">,
  creator: CreatorRow | null,
) {
  const raw = (
    work.discover_category ??
    creator?.category ??
    ""
  ).trim();

  if (!raw) {
    return "";
  }

  return (
    raw.charAt(0).toUpperCase() +
    raw.slice(1)
  );
}



function mapWork(

  work: WorkRow,

  creator: CreatorRow | null,

): FeedItem {

  const category =
    resolveEffectiveCategory(
      work,
      creator,
    );

  const durationSeconds =
    resolveDurationSeconds(work);

  const artistId = creator?.id || undefined;
  const artistName = creator?.name || undefined;
  const artistTags = creator?.tags ?? [];
  const artistUrl = creator
    ? `/creator/${creator.id}`
    : undefined;



  if (

    work.source === "youtube" &&

    work.source_id

  ) {

    return {

      id: String(work.id),

      artistId,

      artistName,

      category,

      artistTags,

      type: "youtube",

      source: work.source,

      videoId: work.source_id,

      image:

        work.thumbnail_url ?? undefined,

      title: work.title,

      description: work.description,

      caption:

        work.description ??

        work.title ??

        null,

      sourceUrl: work.source_url,

      artistUrl,

      durationSeconds,

    };

  }



  if (

    work.source === "tiktok" &&

    work.source_id

  ) {

    return {

      id: String(work.id),

      artistId,

      artistName,

      category,

      artistTags,

      type: "tiktok",

      source: work.source,

      videoId: work.source_id,

      image:

        work.thumbnail_url ?? undefined,

      title: work.title,

      description: work.description,

      caption:

        work.description ??

        work.title ??

        null,

      sourceUrl: work.source_url,

      artistUrl,

      durationSeconds,

    };

  }



  return {

    id: String(work.id),

    artistId,

    artistName,

    category,

    artistTags,

    type: "image",

    source: work.source,

    image:

      work.thumbnail_url ??

      work.source_url,

    title: work.title,

    description: work.description,

    caption:

      work.description ??

      work.title ??

      null,

    sourceUrl: work.source_url,

    artistUrl,

    durationSeconds,

  };

}



function getDiscoverDbCategoriesFilter(
  categories: CreatorCategory[] | null,
): CreatorCategory[] | null {
  if (!categories || categories.length === 0) {
    return null;
  }

  return categories;
}



async function getDiscoverableWorkCount(

  supabase: Awaited<

    ReturnType<typeof createClient>

  >,

  categories: CreatorCategory[] | null = null,

  searchQuery: string | null = null,

) {

  const dbCategories =
    getDiscoverDbCategoriesFilter(categories);

  let countQuery = supabase

    .from("works")

    .select(

      dbCategories

        ? "id, artist:creators(category)"

        : "id",

      {

        count: "exact",

        head: true,

      },

    )

    .eq("featured", false)

    .eq("discover_eligible", true);

  if (dbCategories) {

    countQuery = countQuery.or(
      buildEffectiveCategoryOrFilter(
        dbCategories,
      ),
    );

  }

  countQuery = applyDiscoverSearchFilter(
    countQuery,
    searchQuery,
  );

  const {

    count,

    error,

  } = await countQuery;



  if (error) {

    console.log(

      "LOAD DISCOVER WORK COUNT ERROR:",

      {

        code: error.code,

        message: error.message,

        details: error.details,

        hint: error.hint,

      },

    );



    return 0;

  }



  return count ?? 0;

}



export async function getDiscoverCandidateBatch(

  categories: CreatorCategory[] | null = null,

  round = 0,

  searchQuery: string | null = null,

): Promise<DiscoverCandidateBatch> {

  const normalizedSearch =
    normalizeDiscoverSearchQuery(
      searchQuery,
    );

  const safeRound = Math.max(

    0,

    Math.floor(round),

  );



  const supabase = await createClient();



  const dbCategories =
    getDiscoverDbCategoriesFilter(categories);

  const workCount =

    await getDiscoverableWorkCount(

      supabase,

      categories,

      normalizedSearch,

    );



  const workPageCount = Math.max(

    1,

    Math.ceil(

      workCount / WORKS_PER_BATCH,

    ),

  );

  const workPage =

    safeRound % workPageCount;

  const from =

    workPage * WORKS_PER_BATCH;

  const to =

    from + WORKS_PER_BATCH - 1;



  let worksQuery = supabase

    .from("works")

    .select(

      `

          id,

          type,

          source,

          source_id,

          source_url,

          title,

          description,

          thumbnail_url,

          published_at,

          duration_seconds,

          discover_category,

          artist:creators (

            id,

            name,

            category,

            tags

          )

        `,

    )

    .eq("featured", false)

    .eq("discover_eligible", true);

  if (dbCategories) {

    worksQuery = worksQuery.or(
      buildEffectiveCategoryOrFilter(
        dbCategories,
      ),
    );

  }

  worksQuery = applyDiscoverSearchFilter(
    worksQuery,
    normalizedSearch,
  );

  const { data, error } =

    await worksQuery

      .order("published_at", {

        ascending: false,

        nullsFirst: false,

      })

      .order("id", {

        ascending: false,

      })

      .range(from, to);



  if (error) {

    console.log(

      "LOAD DISCOVER CANDIDATES ERROR:",

      {

        code: error.code,

        message: error.message,

        details: error.details,

        hint: error.hint,

      },

    );



    return {

      works: [],

      nextRound: safeRound + 1,

      artistPageCount: workPageCount,

      artistPage: workPage,

      workPage,

    };

  }



  const rows =

    (data ??

      []) as unknown as WorkWithCreator[];



  const works = rows

    .filter(isDisplayableWork)

    .map((row) => {

      const creator =

        resolveCreator(

          row.artist,

        );



      return mapWork(row, creator);

    })

    .filter(

      (item): item is FeedItem =>

        item !== null,

    );



  const filteredWorks = dbCategories

    ? works.filter((work) =>

        workMatchesDiscoverCategories(

          work,

          dbCategories,

        ),

      )

    : works;



  return {

    works: filteredWorks,

    nextRound: safeRound + 1,

    artistPageCount: workPageCount,

    artistPage: workPage,

    workPage,

  };

}



export async function getRealDiscoverWorks(): Promise<FeedItem[]> {

  const batch =

    await getDiscoverCandidateBatch(

      null,

      0,

    );



  return batch.works;

}

