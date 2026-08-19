import { createClient } from "@/lib/supabase/server";

import type { FeedItem } from "@/components/discover/DiscoverFeed";

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

  artist: {
    id: string;
    name: string;
    category: string;
  } | null;
};

export async function getRealDiscoverWorks(): Promise<FeedItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("works")
    .select(`
      id,
      type,
      source,
      source_id,
      source_url,
      title,
      description,
      thumbnail_url,
      published_at,
      artist:creators (
        id,
        name,
        category
      )
    `)
    .order("published_at", {
      ascending: false,
    });

  if (error) {
  console.log(
    "LOAD DISCOVER WORKS ERROR:",
    {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    },
  );

  return [];
}

  if (!data) {
    return [];
  }

  const works = data as unknown as WorkRow[];

  return works
    .filter((work) => work.artist)
    .map((work) => {
      const artist = work.artist!;

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
    });
}