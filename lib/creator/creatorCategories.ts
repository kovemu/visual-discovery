export const CREATOR_CATEGORIES = [
  "kpop",
  "cheer",
  "look",
] as const;

export type CreatorCategory =
  (typeof CREATOR_CATEGORIES)[number];

export const DEFAULT_CREATOR_CATEGORY: CreatorCategory =
  "kpop";

export const CREATOR_CATEGORY_OPTIONS: ReadonlyArray<{
  value: CreatorCategory;
  label: string;
}> = [
  { value: "kpop", label: "KPOP" },
  { value: "cheer", label: "CHEER" },
  { value: "look", label: "LOOK" },
];

export const ALLOWED_CREATOR_CATEGORIES = [
  ...CREATOR_CATEGORIES,
];

export function isCreatorCategory(
  value: string,
): value is CreatorCategory {
  return (
    CREATOR_CATEGORIES as readonly string[]
  ).includes(value);
}

export function formatCreatorCategoryLabel(
  category: string,
): string {
  const match = CREATOR_CATEGORY_OPTIONS.find(
    (option) => option.value === category,
  );

  if (match) {
    return match.label;
  }

  if (!category) {
    return "Unknown";
  }

  if (category === "cos") {
    return "COS";
  }

  return (
    category.charAt(0).toUpperCase() +
    category.slice(1)
  );
}
