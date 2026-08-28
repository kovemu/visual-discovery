"use client";

import RotatedWorkThumbnail from "@/components/works/RotatedWorkThumbnail";
import RotatedWorkVideo from "@/components/works/RotatedWorkVideo";
import TikTokPlayerEmbed from "@/components/works/TikTokPlayerEmbed";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import type { WorkMediaItem } from "@/lib/works/workDisplay";
import { isRotatedMedia } from "@/lib/works/workRotation";

type WorkMediaModalProps = {
  work: WorkMediaItem;
  isSaved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
};

function getModalTitle(work: WorkMediaItem) {
  const title = work.title?.trim();
  return title || null;
}

function getModalDescription(work: WorkMediaItem) {
  const title = work.title?.trim();

  const description =
    work.description?.trim() ||
    work.caption?.trim() ||
    null;

  if (!description) {
    return null;
  }

  if (title && description === title) {
    return null;
  }

  return description;
}

export default function WorkMediaModal({
  work,
  isSaved,
  onClose,
  onToggleSave,
}: WorkMediaModalProps) {
  const { t } = useTranslation();

  const title = getModalTitle(work);
  const description = getModalDescription(work);

  const hasTextContent = Boolean(
    title || description,
  );

  const isRotatedYoutube =
    work.type === "youtube" &&
    Boolean(work.videoId) &&
    isRotatedMedia(work.rotationDegrees);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-4"
      onClick={onClose}
    >
      <div
        className={`relative flex h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-none flex-col overflow-hidden rounded-2xl bg-[#111111] md:max-h-[80vh] md:w-full md:max-w-4xl md:flex-row ${
          isRotatedYoutube
            ? "md:h-[min(80vh,720px)]"
            : "md:h-auto"
        }`}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-neutral-900">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-lg text-white/80 transition hover:bg-white/15 md:hidden"
          >
            ×
          </button>

          {work.type === "youtube" &&
          work.videoId ? (
            <RotatedWorkVideo
              videoId={work.videoId}
              title={
                work.artistName
                  ? `${work.artistName} video`
                  : "Video"
              }
              rotationDegrees={
                work.rotationDegrees
              }
            />
          ) : work.type === "tiktok" &&
            work.videoId ? (
            <TikTokPlayerEmbed
              videoId={work.videoId}
              title={
                work.artistName
                  ? `${work.artistName} TikTok`
                  : "TikTok"
              }
              className="!h-full !max-h-full !w-full !max-w-full md:!aspect-[9/16] md:!h-[min(80vh,720px)] md:!w-[min(calc(min(80vh,720px)*9/16),100%)]"
            />
          ) : work.image ? (
            <div className="flex h-full w-full overflow-hidden md:max-h-[80vh]">
              <RotatedWorkThumbnail
                src={work.image}
                alt={
                  work.artistName
                    ? `${work.artistName} work`
                    : "Work"
                }
                rotationDegrees={
                  work.rotationDegrees
                }
                layout={
                  isRotatedMedia(
                    work.rotationDegrees,
                  )
                    ? "modal"
                    : "thumbnail"
                }
                imgClassName="max-h-full max-w-full object-contain md:max-h-[80vh] md:w-full"
              />
            </div>
          ) : null}
        </div>

        <aside className="relative w-full shrink-0 bg-[#111111] px-4 py-3 md:w-[300px] md:border-l md:border-white/10 md:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute right-4 top-4 hidden h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-lg text-white/80 transition hover:bg-white/15 md:flex"
          >
            ×
          </button>

          {hasTextContent && (
            <div className="hidden pr-10 md:block">
              {title && (
                <p className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight text-white">
                  {title}
                </p>
              )}

              {description && (
                <p
                  className={`line-clamp-5 text-sm leading-relaxed text-zinc-300 ${
                    title ? "mt-2.5" : ""
                  }`}
                >
                  {description}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleSave}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-semibold transition md:absolute md:left-6 md:right-6 md:top-[43%] md:mt-0 md:w-auto md:-translate-y-1/2 ${
              isSaved
                ? "border-violet-500 bg-violet-600 text-white hover:bg-violet-500"
                : "border-white bg-white text-black hover:bg-white/90"
            }`}
          >
            {isSaved
              ? t("pickedState")
              : t("pick")}
          </button>
        </aside>
      </div>
    </div>
  );
}
