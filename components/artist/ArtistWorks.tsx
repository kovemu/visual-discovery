"use client";

import { useEffect, useState } from "react";

type ArtistWork = {
  id: string;
  type: "image" | "youtube";
  image?: string;
  videoId?: string;
  caption?: string | null;
};

type ArtistWorksProps = {
  works: ArtistWork[];
  artistName: string;
};

export default function ArtistWorks({
  works,
  artistName,
}: ArtistWorksProps) {
  const [selectedWork, setSelectedWork] =
    useState<ArtistWork | null>(null);

  useEffect(() => {
    if (!selectedWork) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedWork(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedWork]);

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-4">
        {works.map((work) => (
          <button
            key={work.id}
            type="button"
            onClick={() => setSelectedWork(work)}
            className="group w-[220px] cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white text-left transition hover:-translate-y-1"
          >
            {work.type === "youtube" && work.videoId ? (
              <div className="relative aspect-[9/16] overflow-hidden bg-black">
                <img
                  src={`https://i.ytimg.com/vi/${work.videoId}/hqdefault.jpg`}
                  alt={`${artistName} video`}
                  draggable={false}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/20" />

                <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-xl text-white">
                  ▶
                </div>
              </div>
            ) : work.image ? (
              <div className="overflow-hidden">
                <img
                  src={work.image}
                  alt={`${artistName} work`}
                  draggable={false}
                  className="h-auto w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
            ) : null}

            {work.caption && (
              <p className="p-4 text-sm leading-6 text-gray-600">
                {work.caption}
              </p>
            )}
          </button>
        ))}
      </div>

      {selectedWork && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setSelectedWork(null)}
        >
          <div
            className="relative max-h-[85vh] overflow-hidden rounded-2xl bg-black"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedWork(null)}
              className="absolute right-4 top-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-xl text-white"
            >
              ×
            </button>

            {selectedWork.type === "youtube" &&
            selectedWork.videoId ? (
              <iframe
                src={`https://www.youtube.com/embed/${selectedWork.videoId}?autoplay=1&rel=0`}
                title={`${artistName} video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-[9/16] h-[80vh] max-h-[760px]"
              />
            ) : selectedWork.image ? (
              <img
                src={selectedWork.image}
                alt={`${artistName} work`}
                className="max-h-[80vh] max-w-[90vw] object-contain"
              />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}