const ANALYTICS_SESSION_STORAGE_KEY =
  "kovemu_analytics_session_id";

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existing = window.localStorage.getItem(
      ANALYTICS_SESSION_STORAGE_KEY,
    );

    if (existing) {
      return existing;
    }

    const sessionId = crypto.randomUUID();
    window.localStorage.setItem(
      ANALYTICS_SESSION_STORAGE_KEY,
      sessionId,
    );

    return sessionId;
  } catch {
    return null;
  }
}
