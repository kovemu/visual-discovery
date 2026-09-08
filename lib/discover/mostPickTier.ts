export type MostPickTier =
  | "silver"
  | "gold"
  | "prism";

export function getMostPickTier(
  pickCount: number | null | undefined,
): MostPickTier | null {
  const count =
    typeof pickCount === "number" &&
    Number.isFinite(pickCount)
      ? Math.max(0, Math.floor(pickCount))
      : 0;

  if (count >= 5) {
    return "prism";
  }

  if (count >= 3) {
    return "gold";
  }

  if (count >= 2) {
    return "silver";
  }

  return null;
}
