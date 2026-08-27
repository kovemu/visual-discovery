import { getSafeNextPath } from "@/lib/auth/safeNextPath";

export function getEmailRedirectTo(nextPath = "/") {
  if (typeof window === "undefined") {
    return undefined;
  }

  const next = getSafeNextPath(nextPath) ?? "/";

  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
