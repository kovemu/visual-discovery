"use client";

import { useEffect, useRef } from "react";

import { trackProductEvent } from "@/lib/analytics/trackProductEvent";

type ProfileOpenTrackerProps = {
  artistId: string;
};

export default function ProfileOpenTracker({
  artistId,
}: ProfileOpenTrackerProps) {
  const trackedArtistIdRef =
    useRef<string | null>(null);

  useEffect(() => {
    if (
      !artistId ||
      trackedArtistIdRef.current === artistId
    ) {
      return;
    }

    trackedArtistIdRef.current = artistId;

    trackProductEvent({
      event_name: "profile_open",
      artist_id: artistId,
    });
  }, [artistId]);

  return null;
}
