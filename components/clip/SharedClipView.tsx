"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { FeedItem } from "@/components/discover/DiscoverFeed";
import WorkMediaModal from "@/components/works/WorkMediaModal";
import {
  ensurePickSession,
  PickSessionError,
} from "@/lib/auth/ensurePickSession";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import { insertWorkPick } from "@/lib/picks/insertWorkPick";
import { createClient } from "@/lib/supabase/client";
import { getAnalyticsSource } from "@/lib/works/workDisplay";

type SharedClipViewProps = {
  work: FeedItem;
};

export default function SharedClipView({
  work,
}: SharedClipViewProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [pickedWorkIds, setPickedWorkIds] = useState<
    Set<string>
  >(new Set());
  const [picksLoaded, setPicksLoaded] = useState(false);
  const [pickError, setPickError] = useState("");

  useEffect(() => {
    async function loadPicks() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPickedWorkIds(new Set());
        setPicksLoaded(true);
        return;
      }

      const { data, error } = await supabase
        .from("work_picks")
        .select("work_id")
        .eq("user_id", user.id);

      if (error) {
        console.error("LOAD PICKS ERROR:", error);
        setPicksLoaded(true);
        return;
      }

      setPickedWorkIds(
        new Set(
          (data ?? []).map((item) =>
            String(item.work_id),
          ),
        ),
      );
      setPicksLoaded(true);
    }

    void loadPicks();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        void loadPicks();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const closeToDiscover = useCallback(() => {
    router.push("/");
  }, [router]);

  useEffect(() => {
    trackProductEvent({
      event_name: "card_open",
      work_id: work.id,
      metadata: {
        source: getAnalyticsSource(work),
        entry: "shared_clip",
      },
    });
  }, [work]);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeToDiscover();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeToDiscover]);

  async function togglePick() {
    setPickError("");

    let userId: string;

    try {
      const user = await ensurePickSession();
      userId = user.id;
    } catch (error) {
      setPickError(
        error instanceof PickSessionError
          ? error.message
          : "Could not save this pick.",
      );
      return;
    }

    const alreadyPicked = pickedWorkIds.has(work.id);

    if (alreadyPicked) {
      setPickedWorkIds((current) => {
        const next = new Set(current);
        next.delete(work.id);
        return next;
      });

      const { error } = await supabase
        .from("work_picks")
        .delete()
        .eq("user_id", userId)
        .eq("work_id", work.id);

      if (error) {
        console.error("REMOVE PICK ERROR:", error);
        setPickedWorkIds((current) => {
          const next = new Set(current);
          next.add(work.id);
          return next;
        });
        return;
      }

      trackProductEvent({
        event_name: "save",
        artist_id: work.artistId,
        work_id: work.id,
        metadata: {
          action: "unsave",
          entry: "shared_clip",
        },
      });
      window.dispatchEvent(
        new Event("kovemu-picks-changed"),
      );
      return;
    }

    setPickedWorkIds((current) => {
      const next = new Set(current);
      next.add(work.id);
      return next;
    });

    const { error } = await insertWorkPick(supabase, {
      userId,
      workId: work.id,
      artistId: work.artistId,
    });

    if (error) {
      console.error("SAVE PICK ERROR:", error);
      setPickedWorkIds((current) => {
        const next = new Set(current);
        next.delete(work.id);
        return next;
      });
      return;
    }

    trackProductEvent({
      event_name: "save",
      artist_id: work.artistId,
      work_id: work.id,
      metadata: {
        action: "save",
        entry: "shared_clip",
      },
    });
    window.dispatchEvent(
      new Event("kovemu-picks-changed"),
    );
  }

  if (!picksLoaded) {
    return (
      <main className="min-h-screen bg-[#050505]" />
    );
  }

  return (
    <main className="min-h-screen bg-[#050505]">
      {pickError ? (
        <p className="fixed left-4 top-4 z-[110] text-sm text-zinc-400">
          {pickError}
        </p>
      ) : null}
      <WorkMediaModal
        work={work}
        isSaved={pickedWorkIds.has(work.id)}
        onClose={closeToDiscover}
        onToggleSave={() => {
          void togglePick();
        }}
      />
    </main>
  );
}
