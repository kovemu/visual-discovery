export type SelectableDiscoverWork = {
  id: string;
  artistId?: string | null;
};

export const DISCOVER_ARTIST_HISTORY_LIMIT = 12;

function normalizeArtistId(
  artistId: string | null | undefined,
) {
  if (typeof artistId !== "string") {
    return null;
  }

  const trimmed = artistId.trim();
  return trimmed || null;
}

export function artistSelectionWeight(
  artistId: string | null | undefined,
  recentArtistIds: string[],
) {
  const normalized = normalizeArtistId(artistId);

  if (!normalized) {
    return 1;
  }

  const window = recentArtistIds.slice(
    -DISCOVER_ARTIST_HISTORY_LIMIT,
  );
  const lastIndex = window.lastIndexOf(normalized);

  if (lastIndex === -1) {
    return 1;
  }

  const distanceFromEnd = window.length - 1 - lastIndex;

  if (distanceFromEnd === 0) {
    return 0.15;
  }

  if (distanceFromEnd <= 2) {
    return 0.35;
  }

  if (distanceFromEnd <= 5) {
    return 0.65;
  }

  return 1;
}

function pickWeightedIndex<T extends SelectableDiscoverWork>(
  remaining: T[],
  recentArtistIds: string[],
) {
  const weights = remaining.map((work) =>
    artistSelectionWeight(work.artistId, recentArtistIds),
  );
  const total = weights.reduce(
    (sum, weight) => sum + weight,
    0,
  );

  if (total <= 0) {
    return Math.floor(Math.random() * remaining.length);
  }

  let cursor = Math.random() * total;

  for (let index = 0; index < remaining.length; index += 1) {
    cursor -= weights[index];

    if (cursor <= 0) {
      return index;
    }
  }

  return remaining.length - 1;
}

export function selectDiscoverWorks<
  T extends SelectableDiscoverWork,
>(
  candidates: T[],
  targetCount: number,
  recentArtistIds: string[],
): {
  selected: T[];
  remaining: T[];
} {
  const remaining: T[] = [];
  const seenCandidateIds = new Set<string>();

  for (const work of candidates) {
    if (seenCandidateIds.has(work.id)) {
      continue;
    }

    seenCandidateIds.add(work.id);
    remaining.push(work);
  }

  const selected: T[] = [];
  const artistHistory = recentArtistIds.slice(
    -DISCOVER_ARTIST_HISTORY_LIMIT,
  );
  const count = Math.max(0, Math.floor(targetCount));

  while (selected.length < count && remaining.length > 0) {
    const index = pickWeightedIndex(remaining, artistHistory);
    const [work] = remaining.splice(index, 1);
    selected.push(work);

    const artistId = normalizeArtistId(work.artistId);

    if (artistId) {
      artistHistory.push(artistId);

      if (artistHistory.length > DISCOVER_ARTIST_HISTORY_LIMIT) {
        artistHistory.splice(
          0,
          artistHistory.length - DISCOVER_ARTIST_HISTORY_LIMIT,
        );
      }
    }
  }

  return { selected, remaining };
}
