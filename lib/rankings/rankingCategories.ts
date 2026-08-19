export const RANKING_CATEGORIES = [
  "Music",
  "Dance",
  "Art",
  "Cosplay",
] as const;

export type RankingCategory =
  (typeof RANKING_CATEGORIES)[number];

export function normalizeRankingCategory(
  category: string,
): RankingCategory {
  const normalized = category
    .trim()
    .toLowerCase();

  const match =
    RANKING_CATEGORIES.find(
      (item) =>
        item.toLowerCase() ===
        normalized,
    );

  return match ?? "Music";
}

export function formatRankingCategory(
  category: string,
) {
  return normalizeRankingCategory(
    category,
  );
}

export function getStableRankOrderKey(
  weekStart: string,
  category: string,
  artistId: string,
) {
  const input = `${weekStart}:${category.toLowerCase()}:${artistId}`;
  let hash = 5381;

  for (
    let index = 0;
    index < input.length;
    index += 1
  ) {
    hash =
      ((hash << 5) + hash) ^
      input.charCodeAt(index);
  }

  return hash >>> 0;
}
