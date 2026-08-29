import { createClient } from "@/lib/supabase/server";



import type { FeedItem } from "@/components/discover/DiscoverFeed";

import {
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



import { normalizeRotationDegrees } from "@/lib/works/workRotation";

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

  rotation_degrees: number | null;

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



const MAX_DISCOVER_SEARCH_TOKENS = 5;

type DiscoverSearchTokenMatch = {
  token: string;
  creatorIds: string[];
};

export function normalizeDiscoverSearchQuery(
  query: string | null | undefined,
): string | null {
  const collapsed = (query?.trim() ?? "").replace(
    /\s+/g,
    " ",
  );

  if (collapsed.length === 0) {
    return null;
  }

  return collapsed.normalize("NFKC");
}

export function tokenizeDiscoverSearchQuery(
  searchQuery: string | null,
): string[] {
  if (!searchQuery) {
    return [];
  }

  return Array.from(
    new Set(
      searchQuery
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_DISCOVER_SEARCH_TOKENS);
}

function escapePostgrestIlikePattern(
  value: string,
): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/_/g, "\\_");
}

function buildDiscoverWorkSearchOrFilter(
  token: string,
  matchingCreatorIds: readonly string[],
): string {
  const pattern = `"*${escapePostgrestIlikePattern(token)}*"`;
  const filters = [
    `title.ilike.${pattern}`,
    `description.ilike.${pattern}`,
  ];

  if (matchingCreatorIds.length > 0) {
    const quotedIds = matchingCreatorIds
      .map((id) => `"${id}"`)
      .join(",");

    filters.push(
      `artist_id.in.(${quotedIds})`,
    );
  }

  return filters.join(",");
}

async function resolveMatchingCreatorIdsForToken(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  token: string,
): Promise<string[]> {
  const pattern = `"*${escapePostgrestIlikePattern(token)}*"`;

  const { data, error } = await supabase
    .from("creators")
    .select("id")
    .or(
      `name.ilike.${pattern},username.ilike.${pattern}`,
    )
    .limit(500);

  if (error) {
    console.log(
      "DISCOVER CREATOR SEARCH ERROR:",
      {
        token,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    return [];
  }

  return (data ?? []).map((row) => row.id);
}

async function resolveDiscoverSearchTokenMatches(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  tokens: readonly string[],
): Promise<DiscoverSearchTokenMatch[]> {
  if (tokens.length === 0) {
    return [];
  }

  const matches = await Promise.all(
    tokens.map(async (token) => ({
      token,
      creatorIds:
        await resolveMatchingCreatorIdsForToken(
          supabase,
          token,
        ),
    })),
  );

  return matches;
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
  tokenMatches: readonly DiscoverSearchTokenMatch[],
): T {
  if (tokenMatches.length === 0) {
    return query;
  }

  let nextQuery = query;

  for (const match of tokenMatches) {
    nextQuery = nextQuery.or(
      buildDiscoverWorkSearchOrFilter(
        match.token,
        match.creatorIds,
      ),
    );
  }

  return nextQuery;
}

const DISCOVER_WORK_SELECT = `

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

          rotation_degrees,

          artist:creators (

            id,

            name,

            category,

            tags

          )

        `;

const DISCOVER_WORK_CREATOR_SELECT = `

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

          rotation_degrees,

          artist:creators!inner (

            id,

            name,

            category,

            tags

          )

        `;

function applyDiscoverCategoryOnWork<
  T extends {
    eq: (
      column: string,
      value: string,
    ) => T;
    in: (
      column: string,
      values: readonly string[],
    ) => T;
  },
>(
  query: T,
  categories: CreatorCategory[],
): T {
  if (categories.length === 1) {
    return query.eq(
      "discover_category",
      categories[0],
    );
  }

  return query.in(
    "discover_category",
    categories,
  );
}

function applyDiscoverCreatorCategory<
  T extends {
    is: (
      column: string,
      value: null,
    ) => T;
    eq: (
      column: string,
      value: string,
    ) => T;
    in: (
      column: string,
      values: readonly string[],
    ) => T;
  },
>(
  query: T,
  categories: CreatorCategory[],
): T {
  let nextQuery = query.is(
    "discover_category",
    null,
  );

  if (categories.length === 1) {
    return nextQuery.eq(
      "creators.category",
      categories[0],
    );
  }

  return nextQuery.in(
    "creators.category",
    categories,
  );
}

function sortDiscoverWorkRows(
  rows: WorkWithCreator[],
) {
  return [...rows].sort((left, right) => {
    const leftTime = left.published_at
      ? Date.parse(left.published_at)
      : 0;
    const rightTime = right.published_at
      ? Date.parse(right.published_at)
      : 0;

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return right.id - left.id;
  });
}

function mergeDiscoverWorkRows(
  rows: WorkWithCreator[],
) {
  return sortDiscoverWorkRows(
    Array.from(
      new Map(
        rows.map((row) => [row.id, row]),
      ).values(),
    ),
  );
}

async function countDiscoverWorksByWorkCategory(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  categories: CreatorCategory[],
  tokenMatches: readonly DiscoverSearchTokenMatch[],
) {
  let countQuery = supabase
    .from("works")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("featured", false)
    .eq("discover_eligible", true);

  countQuery = applyDiscoverCategoryOnWork(
    countQuery,
    categories,
  );
  countQuery = applyDiscoverSearchFilter(
    countQuery,
    tokenMatches,
  );

  const { count, error } = await countQuery;

  if (error) {
    console.log(
      "LOAD DISCOVER WORK CATEGORY COUNT ERROR:",
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

async function countDiscoverWorksByCreatorCategory(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  categories: CreatorCategory[],
  tokenMatches: readonly DiscoverSearchTokenMatch[],
) {
  let countQuery = supabase
    .from("works")
    .select("id, artist:creators!inner(category)", {
      count: "exact",
      head: true,
    })
    .eq("featured", false)
    .eq("discover_eligible", true);

  countQuery = applyDiscoverCreatorCategory(
    countQuery,
    categories,
  );
  countQuery = applyDiscoverSearchFilter(
    countQuery,
    tokenMatches,
  );

  const { count, error } = await countQuery;

  if (error) {
    console.log(
      "LOAD DISCOVER CREATOR CATEGORY COUNT ERROR:",
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

async function fetchDiscoverWorksByWorkCategory(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  categories: CreatorCategory[],
  tokenMatches: readonly DiscoverSearchTokenMatch[],
  fetchThrough: number,
) {
  let worksQuery = supabase
    .from("works")
    .select(DISCOVER_WORK_SELECT)
    .eq("featured", false)
    .eq("discover_eligible", true);

  worksQuery = applyDiscoverCategoryOnWork(
    worksQuery,
    categories,
  );
  worksQuery = applyDiscoverSearchFilter(
    worksQuery,
    tokenMatches,
  );

  const { data, error } = await worksQuery
    .order("published_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", {
      ascending: false,
    })
    .range(0, fetchThrough);

  if (error) {
    console.log(
      "LOAD DISCOVER WORK CATEGORY ROWS ERROR:",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    return [];
  }

  return (data ?? []) as unknown as WorkWithCreator[];
}

async function fetchDiscoverWorksByCreatorCategory(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  categories: CreatorCategory[],
  tokenMatches: readonly DiscoverSearchTokenMatch[],
  fetchThrough: number,
) {
  let worksQuery = supabase
    .from("works")
    .select(DISCOVER_WORK_CREATOR_SELECT)
    .eq("featured", false)
    .eq("discover_eligible", true);

  worksQuery = applyDiscoverCreatorCategory(
    worksQuery,
    categories,
  );
  worksQuery = applyDiscoverSearchFilter(
    worksQuery,
    tokenMatches,
  );

  const { data, error } = await worksQuery
    .order("published_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", {
      ascending: false,
    })
    .range(0, fetchThrough);

  if (error) {
    console.log(
      "LOAD DISCOVER CREATOR CATEGORY ROWS ERROR:",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    return [];
  }

  return (data ?? []) as unknown as WorkWithCreator[];
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

  const rotationDegrees =
    normalizeRotationDegrees(
      work.rotation_degrees,
    );

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

      rotationDegrees,

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

      rotationDegrees,

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

    rotationDegrees,

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

  tokenMatches: readonly DiscoverSearchTokenMatch[] = [],

) {

  const dbCategories =
    getDiscoverDbCategoriesFilter(categories);

  if (!dbCategories) {
    let countQuery = supabase
      .from("works")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("featured", false)
      .eq("discover_eligible", true);

    countQuery = applyDiscoverSearchFilter(
      countQuery,
      tokenMatches,
    );

    const { count, error } = await countQuery;

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

  const [
    workCategoryCount,
    creatorCategoryCount,
  ] = await Promise.all([
    countDiscoverWorksByWorkCategory(
      supabase,
      dbCategories,
      tokenMatches,
    ),
    countDiscoverWorksByCreatorCategory(
      supabase,
      dbCategories,
      tokenMatches,
    ),
  ]);

  return workCategoryCount + creatorCategoryCount;

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

  const searchTokens = tokenizeDiscoverSearchQuery(
    normalizedSearch,
  );

  const tokenMatches =
    searchTokens.length > 0
      ? await resolveDiscoverSearchTokenMatches(
          supabase,
          searchTokens,
        )
      : [];



  const dbCategories =
    getDiscoverDbCategoriesFilter(categories);

  const workCount =

    await getDiscoverableWorkCount(

      supabase,

      categories,

      tokenMatches,

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



  let rows: WorkWithCreator[] = [];

  if (dbCategories) {
    const [
      workCategoryRows,
      creatorCategoryRows,
    ] = await Promise.all([
      fetchDiscoverWorksByWorkCategory(
        supabase,
        dbCategories,
        tokenMatches,
        to,
      ),
      fetchDiscoverWorksByCreatorCategory(
        supabase,
        dbCategories,
        tokenMatches,
        to,
      ),
    ]);

    rows = mergeDiscoverWorkRows([
      ...workCategoryRows,
      ...creatorCategoryRows,
    ]).slice(from, to + 1);
  } else {
    let worksQuery = supabase
      .from("works")
      .select(DISCOVER_WORK_SELECT)
      .eq("featured", false)
      .eq("discover_eligible", true);

    worksQuery = applyDiscoverSearchFilter(
      worksQuery,
      tokenMatches,
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

    rows =
      (data ??
        []) as unknown as WorkWithCreator[];
  }



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

