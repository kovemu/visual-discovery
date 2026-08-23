import { createClient } from "@/lib/supabase/server";

import type { FeedItem } from "@/components/discover/DiscoverFeed";

export const DISCOVER_CATEGORIES = [
  "Music",
  "Dance",
  "Art",
  "Cosplay",
] as const;

export type DiscoverCategory =
  (typeof DISCOVER_CATEGORIES)[number];

const ARTISTS_PER_BATCH = 10;
const WORKS_PER_ARTIST = 6;

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
};

type ArtistWithWorks = {
  id: string;
  name: string;
  category: string;
  works: WorkRow[];
};

export type DiscoverCandidateBatch = {
  works: FeedItem[];
  nextRound: number;
  artistPageCount: number;
  artistPage: number;
  workPage: number;
};

function buildBatchMetadata(
  safeRound: number,
  artistCount: number | null,
) {
  const artistPageCount = Math.max(
    1,
    Math.ceil(
      (artistCount ??
        ARTISTS_PER_BATCH) /
        ARTISTS_PER_BATCH,
    ),
  );

  return {
    artistPageCount,
    artistPage:
      safeRound % artistPageCount,
    workPage: Math.floor(
      safeRound / artistPageCount,
    ),
  };
}

function normalizeCategory(
  category: string,
) {
  return category.trim().toLowerCase();
}

function isDiscoverCategory(
  category: string,
): category is DiscoverCategory {
  return DISCOVER_CATEGORIES.some(
    (item) =>
      normalizeCategory(item) ===
      normalizeCategory(category),
  );
}

function mapWork(
  work: WorkRow,
  artist: ArtistWithWorks,
): FeedItem {
  const category =
    artist.category.charAt(0).toUpperCase() +
    artist.category.slice(1);

  if (
    work.source === "youtube" &&
    work.source_id
  ) {
    return {
      id: String(work.id),

      artistId: artist.id,
      artistName: artist.name,

      category,

      type: "youtube",

      videoId: work.source_id,

      image:
        work.thumbnail_url ?? undefined,

      caption:
        work.description ??
        work.title ??
        null,

      sourceUrl: work.source_url,

      artistUrl: `/creator/${artist.id}`,
    };
  }

  if (
    work.source === "tiktok" &&
    work.source_id
  ) {
    return {
      id: String(work.id),

      artistId: artist.id,
      artistName: artist.name,

      category,

      type: "tiktok",

      videoId: work.source_id,

      image:
        work.thumbnail_url ?? undefined,

      caption:
        work.description ??
        work.title ??
        null,

      sourceUrl: work.source_url,

      artistUrl: `/creator/${artist.id}`,
    };
  }

  return {
    id: String(work.id),

    artistId: artist.id,
    artistName: artist.name,

    category,

    type: "image",

    image:
      work.thumbnail_url ??
      work.source_url,

    caption:
      work.description ??
      work.title ??
      null,

    sourceUrl: work.source_url,

    artistUrl: `/creator/${artist.id}`,
  };
}

export async function getDiscoverCandidateBatch(
  category: string,
  round = 0,
): Promise<DiscoverCandidateBatch> {
  const safeRound = Math.max(
    0,
    Math.floor(round),
  );

  if (!isDiscoverCategory(category)) {
    return {
      works: [],
      nextRound: safeRound + 1,
      ...buildBatchMetadata(
        safeRound,
        null,
      ),
    };
  }

  const supabase = await createClient();

  let artistCount: number | null = null;

  if (safeRound > 0) {
    const {
      count,
      error: countError,
    } = await supabase
      .from("creators")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "category",
        normalizeCategory(category),
      );

    if (countError) {
      console.log(
        "LOAD DISCOVER ARTIST COUNT ERROR:",
        {
          code: countError.code,
          message: countError.message,
          details: countError.details,
          hint: countError.hint,
        },
      );

      return {
        works: [],
        nextRound: safeRound + 1,
        ...buildBatchMetadata(
          safeRound,
          0,
        ),
      };
    }

    artistCount = count ?? 0;
  }

  const {
    artistPageCount,
    artistPage,
    workPage,
  } = buildBatchMetadata(
    safeRound,
    artistCount,
  );

  const artistFrom =
    artistPage * ARTISTS_PER_BATCH;

  const workFrom =
    workPage * WORKS_PER_ARTIST;

  const { data, error } =
    await supabase
      .from("creators")
      .select(`
        id,
        name,
        category,
        works (
          id,
          type,
          source,
          source_id,
          source_url,
          title,
          description,
          thumbnail_url,
          published_at
        )
      `)
      .eq(
        "category",
        normalizeCategory(category),
      )
      .order("id", {
        ascending: false,
      })
      .range(
        artistFrom,
        artistFrom +
          ARTISTS_PER_BATCH -
          1,
      )
      .eq("works.featured", false)
      .order("published_at", {
        referencedTable: "works",
        ascending: false,
      })
      .range(
        workFrom,
        workFrom +
          WORKS_PER_ARTIST -
          1,
        {
          referencedTable: "works",
        },
      );

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
      artistPageCount,
      artistPage,
      workPage,
    };
  }

  const artists =
    (data ?? []) as unknown as ArtistWithWorks[];

  const works = artists.flatMap(
    (artist) =>
      (artist.works ?? []).map(
        (work) =>
          mapWork(work, artist),
      ),
  );

  return {
    works,
    nextRound: safeRound + 1,
    artistPageCount,
    artistPage,
    workPage,
  };
}

export async function getRealDiscoverWorks(): Promise<FeedItem[]> {
  const batches = await Promise.all(
    DISCOVER_CATEGORIES.map(
      (category) =>
        getDiscoverCandidateBatch(
          category,
          0,
        ),
    ),
  );

  return Array.from(
    new Map(
      batches
        .flatMap(
          (batch) => batch.works,
        )
        .map((work) => [
          work.id,
          work,
        ]),
    ).values(),
  );
}