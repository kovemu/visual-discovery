const TOKEN_SEPARATORS =
  /[\s#@/\\|[\](){}<>「」『』【】〔〕、。，．・·•,._!?:;'"“”‘’~`^*+=\-]+/u;

export function normalizeSubjectText(
  value: string | null | undefined,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[A-Za-z]+/g, (chunk) => chunk.toLowerCase());
}

export function compactSubjectText(
  value: string | null | undefined,
): string {
  return normalizeSubjectText(value).replace(TOKEN_SEPARATORS, "");
}

export function tokenizeSubjectText(
  value: string | null | undefined,
): string[] {
  const normalized = normalizeSubjectText(value);

  if (!normalized) {
    return [];
  }

  return normalized.split(TOKEN_SEPARATORS).filter(Boolean);
}

export function normalizeSubjectAlias(
  value: string | null | undefined,
): string {
  return compactSubjectText(value);
}
