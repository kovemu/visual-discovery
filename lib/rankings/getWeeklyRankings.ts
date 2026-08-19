import { createClient } from "@/lib/supabase/server";
import {
  formatRankingCategory,
  getStableRankOrderKey,
  normalizeRankingCategory,
} from "@/lib/rankings/rankingCategories";
import { getWeekStart } from "@/lib/votes/getWeekStart";

export type WeeklyRankingArtist = {
  rank: number;
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
};

type CreatorRow = {
  id: string;
  name: string;
  category: string;
  profile_image: string | null;
  cover_image: string | null;
};

function resolveArtistImage(
  artist: CreatorRow,
) {
  if (artist.profile_image) {
    return artist.profile_image;
  }

  if (artist.cover_image) {
    return artist.cover_image;
  }

  return null;
}

export async function getWeeklyRankings(
  categoryInput: string,
): Promise<WeeklyRankingArtist[]> {
  const category =
    normalizeRankingCategory(
      categoryInput,
    );
  const normalizedCategory =
    category.toLowerCase();
  const weekStart = getWeekStart();
  const supabase =
    await createClient();

  const [
    { data: votes, error: votesError },
    {
      data: artists,
      error: artistsError,
    },
  ] = await Promise.all([
    supabase
      .from("artist_votes")
      .select("artist_id")
      .eq("week_start", weekStart)
      .eq(
        "category",
        normalizedCategory,
      ),
    supabase
      .from("creators")
      .select(
        "id, name, category, profile_image, cover_image",
      )
      .eq(
        "category",
        normalizedCategory,
      ),
  ]);

  if (votesError) {
    console.error(
      "LOAD WEEKLY RANKING VOTES ERROR:",
      votesError,
    );
  }

  if (artistsError) {
    console.error(
      "LOAD WEEKLY RANKING ARTISTS ERROR:",
      artistsError,
    );

    return [];
  }

  const artistRows =
    (artists ??
      []) as CreatorRow[];

  if (artistRows.length === 0) {
    return [];
  }

  const voteCounts = new Map<
    string,
    number
  >();

  for (const vote of votes ?? []) {
    voteCounts.set(
      vote.artist_id,
      (voteCounts.get(
        vote.artist_id,
      ) ?? 0) + 1,
    );
  }

  const rankedArtists = artistRows
    .map((artist) => ({
      artist,
      voteCount:
        voteCounts.get(artist.id) ??
        0,
      stableKey:
        getStableRankOrderKey(
          weekStart,
          normalizedCategory,
          artist.id,
        ),
    }))
    .sort((a, b) => {
      if (
        b.voteCount !== a.voteCount
      ) {
        return (
          b.voteCount - a.voteCount
        );
      }

      return (
        a.stableKey - b.stableKey
      );
    });

  const slotCount = Math.min(
    5,
    rankedArtists.length,
  );

  return rankedArtists
    .slice(0, slotCount)
    .map((entry, index) => ({
      rank: index + 1,
      id: entry.artist.id,
      name: entry.artist.name,
      category: formatRankingCategory(
        entry.artist.category,
      ),
      imageUrl: resolveArtistImage(
        entry.artist,
      ),
    }));
}
