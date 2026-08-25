"use client";

import { useEffect } from "react";

import TikTokPlayerEmbed from "@/components/works/TikTokPlayerEmbed";
import { useOverlayHistory } from "@/lib/hooks/useOverlayHistory";

export type ProfileWork = {
  id: string;
  type: "image" | "youtube" | "tiktok";
  image?: string;
  videoId?: string;
  caption: string | null;
};

type ProfileWorkModalProps = {
  work: ProfileWork | null;
  artistName: string;
  onClose: () => void;
};

export default function ProfileWorkModal({
  work,
  artistName,
  onClose,
}: ProfileWorkModalProps) {
  const { requestClose } =
    useOverlayHistory(
      "work",
      work !== null,
      onClose,
    );

  useEffect(() => {
    if (!work) return;

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    document.body.style.overflow = "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow = "";

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [work, requestClose]);

  if (!work) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={requestClose}
    >
      <div
        className="relative max-h-[85vh] overflow-hidden rounded-2xl bg-black"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-xl text-white"
        >
          ×
        </button>

        {work.type === "youtube" &&
        work.videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${work.videoId}?autoplay=1&rel=0`}
            title={`${artistName} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-[9/16] h-[80vh] max-h-[760px]"
          />
        ) : work.type === "tiktok" &&
          work.videoId ? (
          <TikTokPlayerEmbed
            videoId={work.videoId}
            title={`${artistName} video`}
          />
        ) : work.image ? (
          <img
            src={work.image}
            alt={`${artistName} work`}
            className="max-h-[80vh] max-w-[90vw] object-contain"
          />
        ) : null}
      </div>
    </div>
  );
}
