"use client";

import {
  useState,
} from "react";

type TikTokThumbnailProps = {
  src?: string | null;
  alt: string;
  className?: string;
  placeholderClassName?: string;
};

export default function TikTokThumbnail({
  src,
  alt,
  className = "",
  placeholderClassName = "",
}: TikTokThumbnailProps) {
  const [
    failed,
    setFailed,
  ] = useState(false);

  if (!src?.trim() || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-900 text-sm font-medium text-white/50 ${placeholderClassName}`}
      >
        TikTok
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
      }}
      className={className}
    />
  );
}
