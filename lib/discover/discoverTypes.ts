export const DISCOVER_TYPES = [
  "girl",
  "boy",
  "solo",
] as const;

export type DiscoverType =
  (typeof DISCOVER_TYPES)[number];

export const DISCOVER_TYPE_TO_TAG: Record<
  DiscoverType,
  string
> = {
  girl: "Girl Group",
  boy: "Boy Group",
  solo: "Solo",
};

export function isDiscoverType(
  value: string,
): value is DiscoverType {
  return DISCOVER_TYPES.includes(
    value as DiscoverType,
  );
}

export function parseDiscoverTypesParam(
  param: string | null,
): DiscoverType[] {
  if (!param?.trim()) {
    return [...DISCOVER_TYPES];
  }

  const parsed = param
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter(isDiscoverType);

  const unique = [
    ...new Set(parsed),
  ] as DiscoverType[];

  if (unique.length === 0) {
    return [...DISCOVER_TYPES];
  }

  return unique;
}

export function getTypesSignature(
  types: DiscoverType[],
) {
  return [...types].sort().join(",");
}

export function discoverTypesToTags(
  types: DiscoverType[],
) {
  return types.map(
    (type) =>
      DISCOVER_TYPE_TO_TAG[type],
  );
}
