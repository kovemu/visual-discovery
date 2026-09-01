import {
  compactSubjectText,
  tokenizeSubjectText,
} from "@/lib/subjects/normalizeSubjectText";
import type { SubjectMatchMode } from "@/lib/subjects/subjectTypes";

export function isUsableAlias(alias: {
  auto_match_enabled: boolean;
  normalized_alias: string;
}) {
  return (
    alias.auto_match_enabled &&
    alias.normalized_alias.length >= 2
  );
}

export function matchesByMode(
  text: string,
  normalizedAlias: string,
  matchMode: SubjectMatchMode,
) {
  if (!text || !normalizedAlias) {
    return false;
  }

  if (matchMode === "token") {
    return tokenizeSubjectText(text).some(
      (token) => token === normalizedAlias,
    );
  }

  return compactSubjectText(text).includes(normalizedAlias);
}
