import {
  CREATOR_CATEGORIES,
  type CreatorCategory,
} from "@/lib/creator/creatorCategories";

export const DISCOVER_CATEGORIES = [
  "all",
  ...CREATOR_CATEGORIES,
] as const;

export type DiscoverCategory =
  (typeof DISCOVER_CATEGORIES)[number];

export const FILTERED_DISCOVER_CATEGORIES =
  CREATOR_CATEGORIES;

export type FilteredDiscoverCategory =
  CreatorCategory;

/** @deprecated use DiscoverCategory */
export type DiscoverRowCategory = DiscoverCategory;

export const DISCOVER_CATEGORY_TABS: {
  id: DiscoverCategory;
  label: string;
}[] = [
  { id: "all", label: "ALL" },
  { id: "kpop", label: "KPOP" },
  { id: "cheer", label: "CHEER" },
  { id: "cos", label: "COS" },
  { id: "look", label: "LOOK" },
];

export function isDiscoverCategory(
  value: string | null | undefined,
): value is DiscoverCategory {
  return (
    value === "all" ||
    value === "kpop" ||
    value === "cheer" ||
    value === "cos" ||
    value === "look"
  );
}

export function isFilteredDiscoverCategory(
  category: DiscoverCategory,
): category is FilteredDiscoverCategory {
  return category !== "all";
}

/** @deprecated use isDiscoverCategory */
export const isDiscoverRowCategory =
  isDiscoverCategory;

export function parseDiscoverCategory(
  value: string | null,
): DiscoverCategory | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return isDiscoverCategory(normalized)
    ? normalized
    : null;
}

/** @deprecated use parseDiscoverCategory */
export const parseDiscoverRowCategory =
  parseDiscoverCategory;

export function workMatchesDiscoverCategory(
  work: {
    category?: string;
  },
  category: DiscoverCategory,
): boolean {
  if (category === "all") {
    return true;
  }

  return (
    (work.category ?? "").trim().toLowerCase() ===
    category
  );
}

/** @deprecated use workMatchesDiscoverCategory */
export const workMatchesRowCategory =
  workMatchesDiscoverCategory;
