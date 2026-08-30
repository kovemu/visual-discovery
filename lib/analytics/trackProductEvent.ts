import { getAnalyticsSessionId } from "@/lib/analytics/getAnalyticsSessionId";

export const PRODUCT_EVENT_NAMES = [
  "discover_view",
  "discover_set_view",
  "card_open",
  "save",
  "next",
  "original_click",
  "pick",
  "pass_next",
  "profile_open",
  "signup",
] as const;

export type ProductEventName =
  (typeof PRODUCT_EVENT_NAMES)[number];

type TrackProductEventInput = {
  event_name: ProductEventName;
  artist_id?: string;
  work_id?: string;
  metadata?: Record<
    string,
    string | number | boolean
  >;
};

export function trackProductEvent(
  input: TrackProductEventInput,
) {
  const session_id =
    getAnalyticsSessionId();

  if (!session_id) {
    return;
  }

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      session_id,
    }),
    keepalive: true,
  }).catch(() => {
    // Analytics must never block UX.
  });
}
