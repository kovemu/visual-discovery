"use client";

import TikTokPlayerEmbed from "@/components/works/TikTokPlayerEmbed";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import {
  getSourceLabel,
  type WorkMediaItem,
} from "@/lib/works/workDisplay";

type WorkMediaModalProps = {
  work: WorkMediaItem;
  isSaved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
  onOriginalClick?: () => void;
};

export default function WorkMediaModal({
  work,
  isSaved,
  onClose,
  onToggleSave,
  onOriginalClick,
}: WorkMediaModalProps) {
  const { t } = useTranslation();

  const sourceLabel = getSourceLabel(
    work,
    {
      youtube: t("sourceYoutube"),
      tiktok: t("sourceTiktok"),
      image: t("sourceImage"),
    },
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-none flex-col overflow-hidden rounded-2xl bg-white md:h-auto md:max-h-[80vh] md:w-full md:max-w-4xl md:flex-row"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-neutral-900">
          {work.type === "youtube" &&
          work.videoId ? (
            <iframe
              src={`https://www.youtube.com/embed/${work.videoId}?autoplay=1&rel=0`}
              title={`${work.artistName} video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full max-h-full w-full max-w-full border-0 md:aspect-[9/16] md:max-h-[80vh] md:w-full"
            />
          ) : work.type === "tiktok" &&
            work.videoId ? (
            <TikTokPlayerEmbed
              videoId={work.videoId}
              title={`${work.artistName} TikTok`}
              className="!h-full !max-h-full !w-full !max-w-full md:!aspect-[9/16] md:!h-[min(80vh,720px)] md:!w-[min(calc(min(80vh,720px)*9/16),100%)]"
            />
          ) : (
            <img
              src={work.image}
              alt={`${work.artistName} work`}
              draggable={false}
              className="max-h-full max-w-full object-contain md:max-h-[80vh] md:w-full"
            />
          )}
        </div>

        <aside className="relative w-full shrink-0 bg-white px-4 py-3.5 md:w-[300px] md:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 transition hover:bg-gray-200 hover:text-gray-950 md:right-4 md:top-4"
          >
            ×
          </button>

          <div className="pr-10">
            <p className="truncate text-lg font-bold tracking-tight text-gray-950 md:text-xl">
              {work.artistName ||
                sourceLabel}
            </p>
            {work.artistName && (
              <p className="mt-0.5 text-sm text-gray-500">
                {sourceLabel}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleSave}
            className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-semibold transition md:mt-6 ${
              isSaved
                ? "border-gray-950 bg-gray-950 text-white hover:bg-gray-800"
                : "border-gray-200 bg-white text-gray-800 hover:border-gray-400"
            }`}
          >
            {isSaved
              ? t("savedState")
              : t("save")}
          </button>

          {work.sourceUrl && (
            <a
              href={work.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onOriginalClick}
              className="mt-2 flex h-11 w-full items-center justify-center rounded-full border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-800 transition hover:border-gray-400 md:mt-3"
            >
              {t("viewOriginal")}
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
