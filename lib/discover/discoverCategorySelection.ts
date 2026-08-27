import {
  CREATOR_CATEGORIES,
  isCreatorCategory,
  type CreatorCategory,
} from "@/lib/creator/creatorCategories";

export function createAllSelectedCategories(): Set<CreatorCategory> {
  return new Set(CREATOR_CATEGORIES);
}

export function isAllDiscoverCategoriesSelected(
  selected: Set<CreatorCategory>,
): boolean {
  return selected.size === CREATOR_CATEGORIES.length;
}

export function buildDiscoverCategorySignature(
  selected: Set<CreatorCategory>,
): string {
  if (isAllDiscoverCategoriesSelected(selected)) {
    return "all";
  }

  return CREATOR_CATEGORIES.filter((category) =>
    selected.has(category),
  ).join(",");
}

export function parseDiscoverCategoriesParam(
  value: string | null,
): CreatorCategory[] | null {
  if (!value?.trim()) {
    return null;
  }

  const requested = value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(isCreatorCategory);

  if (requested.length === 0) {
    return null;
  }

  const unique = CREATOR_CATEGORIES.filter((category) =>
    requested.includes(category),
  );

  if (unique.length === 0 || unique.length >= CREATOR_CATEGORIES.length) {
    return null;
  }

  return unique;
}

export function handleAllCategoryClick(
  _current: Set<CreatorCategory>,
): Set<CreatorCategory> {
  return createAllSelectedCategories();
}

export function handleCreatorCategoryClick(
  current: Set<CreatorCategory>,
  category: CreatorCategory,
): Set<CreatorCategory> {
  if (isAllDiscoverCategoriesSelected(current)) {
    return new Set([category]);
  }

  const next = new Set(current);

  if (next.has(category)) {
    if (next.size === 1) {
      return next;
    }

    next.delete(category);
    return next;
  }

  next.add(category);
  return next;
}

export function workMatchesDiscoverCategories(
  work: {
    category?: string;
  },
  categories: CreatorCategory[] | null,
): boolean {
  if (!categories || categories.length === 0) {
    return true;
  }

  const workCategory = (work.category ?? "")
    .trim()
    .toLowerCase();

  return categories.some(
    (category) => category === workCategory,
  );
}

export function buildEffectiveCategoryOrFilter(
  categories: CreatorCategory[],
): string {
  if (categories.length === 1) {
    const category = categories[0];

    return `discover_category.eq.${category},and(discover_category.is.null,creators.category.eq.${category})`;
  }

  const list = categories.join(",");

  return `discover_category.in.(${list}),and(discover_category.is.null,creators.category.in.(${list}))`;
}
