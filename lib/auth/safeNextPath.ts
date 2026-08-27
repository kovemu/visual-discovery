export function getSafeNextPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://")
  ) {
    return undefined;
  }

  return value;
}
