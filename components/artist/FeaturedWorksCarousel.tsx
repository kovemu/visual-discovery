"use client";

import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import TikTokPlayerEmbed from "@/components/works/TikTokPlayerEmbed";
import TikTokThumbnail from "@/components/works/TikTokThumbnail";

type FeaturedWork = {
  id: string;
  type: "image" | "youtube" | "tiktok";
  image?: string;
  videoId?: string;
  caption: string | null;
  publishedAt?: string;
};

type FeaturedWorksCarouselProps = {
  works: FeaturedWork[];
  artistName: string;
};

export default function FeaturedWorksCarousel({
  works,
  artistName,
}: FeaturedWorksCarouselProps) {
  const scrollRef =
    useRef<HTMLDivElement | null>(null);

  const [canScrollLeft, setCanScrollLeft] =
    useState(false);

  const [canScrollRight, setCanScrollRight] =
    useState(false);

  const [
    selectedWork,
    setSelectedWork,
  ] = useState<FeaturedWork | null>(
    null,
  );

  const sortedWorks = useMemo(() => {
    return [...works].sort((a, b) => {
      const aTime = a.publishedAt
        ? new Date(a.publishedAt).getTime()
        : 0;

      const bTime = b.publishedAt
        ? new Date(b.publishedAt).getTime()
        : 0;

      return bTime - aTime;
    });
  }, [works]);

  const updateScrollState = () => {
    const container = scrollRef.current;

    if (!container) return;

    setCanScrollLeft(
      container.scrollLeft > 5,
    );

    setCanScrollRight(
      container.scrollLeft +
        container.clientWidth <
        container.scrollWidth - 5,
    );
  };

  useEffect(() => {
    updateScrollState();

    const container = scrollRef.current;

    if (!container) return;

    container.addEventListener(
      "scroll",
      updateScrollState,
    );

    window.addEventListener(
      "resize",
      updateScrollState,
    );

    return () => {
      container.removeEventListener(
        "scroll",
        updateScrollState,
      );

      window.removeEventListener(
        "resize",
        updateScrollState,
      );
    };
  }, [sortedWorks]);

  useEffect(() => {
    if (!selectedWork) return;

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setSelectedWork(null);
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
  }, [selectedWork]);

  const scrollLeft = () => {
    const container = scrollRef.current;

    if (!container || !canScrollLeft) {
      return;
    }

    container.scrollBy({
      left: -container.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  const scrollRight = () => {
    const container = scrollRef.current;

    if (!container || !canScrollRight) {
      return;
    }

    container.scrollBy({
      left: container.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  return (
    <>
      <div className="relative mt-6">
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pr-[120px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sortedWorks.map((work) => (
            <article
              key={work.id}
              className="w-[calc((100%-20px)/2)] min-w-[calc((100%-20px)/2)] shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white"
            >
              {work.type === "youtube" &&
              work.videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${work.videoId}?rel=0`}
                  title={`${artistName} featured work`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="aspect-video w-full"
                />
              ) : work.type === "tiktok" &&
                work.videoId ? (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedWork(work)
                  }
                  className="group relative block w-full cursor-pointer text-left"
                >
                  <div className="relative aspect-[9/16] overflow-hidden bg-black">
                    <TikTokThumbnail
                      src={work.image}
                      alt={`${artistName} featured work`}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      placeholderClassName="h-full w-full"
                    />

                    <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/20" />

                    <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white">
                      ▶
                    </div>
                  </div>
                </button>
              ) : work.image ? (
                <img
                  src={work.image}
                  alt={`${artistName} featured work`}
                  draggable={false}
                  className="aspect-video w-full object-cover"
                />
              ) : null}

              {work.caption && (
                <div className="p-4">
                  <p className="line-clamp-1 text-sm font-semibold leading-5 text-gray-950">
                    {work.caption}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>

        {sortedWorks.length > 2 && (
          <>
            <button
              type="button"
              onClick={scrollLeft}
              aria-label="Previous featured works"
              className={`absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow-sm transition ${
                canScrollLeft
                  ? "cursor-pointer opacity-100 hover:scale-105"
                  : "cursor-default opacity-30"
              }`}
            >
              <ChevronLeft size={21} />
            </button>

            <button
              type="button"
              onClick={scrollRight}
              aria-label="Next featured works"
              className={`absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow-sm transition ${
                canScrollRight
                  ? "cursor-pointer opacity-100 hover:scale-105"
                  : "cursor-default opacity-30"
              }`}
            >
              <ChevronRight size={21} />
            </button>
          </>
        )}
      </div>

      {selectedWork &&
        selectedWork.type === "tiktok" &&
        selectedWork.videoId && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() =>
              setSelectedWork(null)
            }
          >
            <div
              className="relative max-h-[85vh] overflow-hidden rounded-2xl bg-black"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedWork(null)
                }
                aria-label="Close"
                className="absolute right-4 top-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-xl text-white"
              >
                ×
              </button>

              <TikTokPlayerEmbed
                videoId={
                  selectedWork.videoId
                }
                title={`${artistName} featured work`}
              />
            </div>
          </div>
        )}
    </>
  );
}
