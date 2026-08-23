"use client";

import {
  useEffect,
} from "react";

const YOUTUBE_VIDEO_ID_PATTERN =
  /^[\w-]{11}$/;

function isValidYouTubeVideoId(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" &&
    YOUTUBE_VIDEO_ID_PATTERN.test(
      value,
    )
  );
}

export function extractYouTubeVideoId(
  url: string,
) {
  if (!url.trim()) {
    return null;
  }

  try {
    const parsed = new URL(
      url.trim(),
    );
    const hostname =
      parsed.hostname
        .replace(/^www\./, "")
        .toLowerCase();

    if (hostname === "youtu.be") {
      const videoId =
        parsed.pathname
          .split("/")
          .filter(Boolean)[0];

      return isValidYouTubeVideoId(
        videoId,
      )
        ? videoId
        : null;
    }

    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname ===
        "music.youtube.com"
    ) {
      if (
        parsed.pathname === "/watch"
      ) {
        const videoId =
          parsed.searchParams.get(
            "v",
          );

        return isValidYouTubeVideoId(
          videoId,
        )
          ? videoId
          : null;
      }

      const parts =
        parsed.pathname
          .split("/")
          .filter(Boolean);

      if (
        parts[0] === "shorts" ||
        parts[0] === "embed" ||
        parts[0] === "live"
      ) {
        return isValidYouTubeVideoId(
          parts[1],
        )
          ? parts[1]
          : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getYouTubeEmbedUrl(
  videoId: string,
) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
}

type YouTubePreviewModalProps = {
  videoId: string;
  title?: string;
  onClose: () => void;
};

export default function YouTubePreviewModal({
  videoId,
  title,
  onClose,
}: YouTubePreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";
    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-[min(1100px,94vw)]"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-11 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/25"
          aria-label="Close preview"
        >
          ×
        </button>

        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
          <iframe
            key={videoId}
            src={getYouTubeEmbedUrl(
              videoId,
            )}
            title={
              title ??
              "YouTube preview"
            }
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}

type YouTubePreviewThumbnailProps = {
  url: string;
  title: string;
  thumbnail: string;
  onPreview: (
    videoId: string,
    title: string,
  ) => void;
  className?: string;
};

export function YouTubePreviewThumbnail({
  url,
  title,
  thumbnail,
  onPreview,
  className = "",
}: YouTubePreviewThumbnailProps) {
  const videoId =
    extractYouTubeVideoId(url);

  if (!videoId) {
    return (
      <img
        src={thumbnail}
        alt={title}
        className={className}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onPreview(
          videoId,
          title,
        );
      }}
      className={`group relative block h-full w-full ${className}`}
      aria-label={`Preview ${title}`}
    >
      <img
        src={thumbnail}
        alt={title}
        className="h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-sm text-white opacity-0 transition group-hover:opacity-100">
          ▶
        </span>
      </div>
    </button>
  );
}
