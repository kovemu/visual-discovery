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
const DISCOVER_EFFECTIVE_VIEW =
  "discover_works_effective";

const DISCOVER_EFFECTIVE_SELECT = `
          id,
          artist_id,
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
          thumbnail_rotation_degrees,
          artist_name,
          artist_username,
          artist_category,
          artist_tags,
          effective_category
        `;

type DiscoverEffectiveRow = {
  id: number;
  artist_id: string | null;
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
  thumbnail_rotation_degrees: number | null;
  artist_name: string | null;
  artist_username: string | null;
  artist_category: string | null;
  artist_tags: string[] | null;
  effective_category: string | null;
};



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

  thumbnail_rotation_degrees: number | null;

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

function buildDiscoverEffectiveViewSearchOrFilter(
  token: string,
) {
  const pattern = `"*${escapePostgrestIlikePattern(token)}*"`;

  return [
    `title.ilike.${pattern}`,
    `description.ilike.${pattern}`,
    `artist_name.ilike.${pattern}`,
    `artist_username.ilike.${pattern}`,
  ].join(",");
}

function applyDiscoverEffectiveSearchFilter<
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
      buildDiscoverEffectiveViewSearchOrFilter(
        match.token,
      ),
    );
  }

  return nextQuery;
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

          thumbnail_rotation_degrees,

          artist:creators (

            id,

            name,

            category,

            tags

          )

        `;

function applyDiscoverEffectiveCategoryFilter<
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
      "effective_category",
      categories[0],
    );
  }

  return query.in(
    "effective_category",
    categories,
  );
}

function effectiveRowToWorkWithCreator(
  row: DiscoverEffectiveRow,
): WorkWithCreator {
  const artist = row.artist_id
    ? {
        id: row.artist_id,
        name: row.artist_name ?? "",
        category: row.artist_category ?? "",
        tags: row.artist_tags ?? [],
      }
    : null;

  return {
    id: row.id,
    type: row.type,
    source: row.source,
    source_id: row.source_id,
    source_url: row.source_url,
    title: row.title,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
    published_at: row.published_at,
    duration_seconds: row.duration_seconds,
    discover_category: row.discover_category,
    rotation_degrees: row.rotation_degrees,
    thumbnail_rotation_degrees:
      row.thumbnail_rotation_degrees,
    artist,
  };
}

async function countDiscoverWorksByEffectiveCategory(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  categories: CreatorCategory[],
  tokenMatches: readonly DiscoverSearchTokenMatch[],
) {
  let countQuery = supabase
    .from(DISCOVER_EFFECTIVE_VIEW)
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("featured", false)
    .eq("discover_eligible", true);

  countQuery =
    applyDiscoverEffectiveCategoryFilter(
      countQuery,
      categories,
    );
  countQuery =
    applyDiscoverEffectiveSearchFilter(
      countQuery,
      tokenMatches,
    );

  const { count, error } = await countQuery;

  if (error) {
    console.log(
      "LOAD DISCOVER EFFECTIVE CATEGORY COUNT ERROR:",
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

async function fetchDiscoverWorksByEffectiveCategory(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  categories: CreatorCategory[],
  tokenMatches: readonly DiscoverSearchTokenMatch[],
  from: number,
  to: number,
) {
  let worksQuery = supabase
    .from(DISCOVER_EFFECTIVE_VIEW)
    .select(DISCOVER_EFFECTIVE_SELECT)
    .eq("featured", false)
    .eq("discover_eligible", true);

  worksQuery =
    applyDiscoverEffectiveCategoryFilter(
      worksQuery,
      categories,
    );
  worksQuery =
    applyDiscoverEffectiveSearchFilter(
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
    .range(from, to);

  if (error) {
    console.log(
      "LOAD DISCOVER EFFECTIVE CATEGORY ROWS ERROR:",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    return [];
  }

  return (data ??
    []) as unknown as DiscoverEffectiveRow[];
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

  const thumbnailRotationDegrees =
    normalizeRotationDegrees(
      work.thumbnail_rotation_degrees,
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

      thumbnailRotationDegrees,

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

      thumbnailRotationDegrees,

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

    thumbnailRotationDegrees,

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

  return countDiscoverWorksByEffectiveCategory(
    supabase,
    dbCategories,
    tokenMatches,
  );

}

export async function getDiscoverCandidatePageCount(
  categories: CreatorCategory[] | null = null,
  searchQuery: string | null = null,
) {
  const supabase = await createClient();
  const normalizedSearch =
    normalizeDiscoverSearchQuery(
      searchQuery,
    );
  const searchTokens =
    tokenizeDiscoverSearchQuery(
      normalizedSearch,
    );
  const tokenMatches =
    searchTokens.length > 0
      ? await resolveDiscoverSearchTokenMatches(
          supabase,
          searchTokens,
        )
      : [];

  const workCount =
    await getDiscoverableWorkCount(
      supabase,
      categories,
      tokenMatches,
    );

  return Math.max(
    1,
    Math.ceil(
      workCount / WORKS_PER_BATCH,
    ),
  );
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
    const effectiveRows =
      await fetchDiscoverWorksByEffectiveCategory(
        supabase,
        dbCategories,
        tokenMatches,
        from,
        to,
      );

    rows = effectiveRows.map(
      effectiveRowToWorkWithCreator,
    );
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

export async function getDiscoverWorkById(
  workId: string,
): Promise<FeedItem | null> {
  const parsedId = Number(workId);

  if (
    !Number.isFinite(parsedId) ||
    parsedId <= 0 ||
    !Number.isInteger(parsedId)
  ) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .select(DISCOVER_WORK_SELECT)
    .eq("id", parsedId)
    .eq("discover_eligible", true)
    .maybeSingle();

  if (error) {
    console.log("LOAD DISCOVER WORK BY ID ERROR:", {
      workId: parsedId,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as WorkWithCreator;

  if (!isDisplayableWork(row)) {
    return null;
  }

  return mapWork(row, resolveCreator(row.artist));
}

