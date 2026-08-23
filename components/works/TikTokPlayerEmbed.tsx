"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getTikTokPlayerUrl } from "@/lib/tiktok/getTikTokPlayerUrl";

type TikTokPlayerEmbedProps = {
  videoId: string;
  title: string;
  className?: string;
};

type TikTokPlayerCommand =
  | "play"
  | "pause"
  | "unMute";

function postTikTokPlayerCommand(
  iframe: HTMLIFrameElement,
  type: TikTokPlayerCommand,
) {
  iframe.contentWindow?.postMessage(
    {
      type,
      "x-tiktok-player": true,
    },
    "*",
  );
}

function isTikTokEmbedMessage(
  data: unknown,
): data is Record<string, unknown> {
  return (
    Boolean(data) &&
    typeof data === "object" &&
    (data as Record<string, unknown>)[
      "x-tiktok-player"
    ] === true
  );
}

function logTikTokPlayerEvent(
  label: string,
  payload: Record<string, unknown>,
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug(
    `[TikTokPlayerEmbed] ${label}`,
    payload,
  );
}

export default function TikTokPlayerEmbed({
  videoId,
  title,
  className = "",
}: TikTokPlayerEmbedProps) {
  const iframeRef =
    useRef<HTMLIFrameElement | null>(
      null,
    );
  const [
    useMutedFallback,
    setUseMutedFallback,
  ] = useState(false);

  useEffect(() => {
    setUseMutedFallback(false);
  }, [videoId]);

  const playerSrc = useMemo(
    () =>
      getTikTokPlayerUrl(videoId, {
        autoplay: true,
        muted: useMutedFallback,
      }),
    [videoId, useMutedFallback],
  );

  useEffect(() => {
    function handleMessage(
      event: MessageEvent,
    ) {
      const data = event.data;

      if (!isTikTokEmbedMessage(data)) {
        return;
      }

      if (data.type === "onMute") {
        logTikTokPlayerEvent(
          "onMute",
          {
            muted: data.value,
            videoId,
            useMutedFallback,
          },
        );
      }

      if (
        data.type === "onPlayerError"
      ) {
        logTikTokPlayerEvent(
          "onPlayerError",
          {
            errorCode: data.errorCode,
            errorType: data.errorType,
            videoId,
            useMutedFallback,
          },
        );
      }

      if (
        data.type === "onPlayerReady" &&
        iframeRef.current
      ) {
        if (!useMutedFallback) {
          postTikTokPlayerCommand(
            iframeRef.current,
            "unMute",
          );
        }

        postTikTokPlayerCommand(
          iframeRef.current,
          "play",
        );
      }

      if (
        data.type === "onPlayerError" &&
        data.errorType ===
          "AUTOPLAY_ERROR" &&
        !useMutedFallback
      ) {
        setUseMutedFallback(true);
      }
    }

    window.addEventListener(
      "message",
      handleMessage,
    );

    return () => {
      window.removeEventListener(
        "message",
        handleMessage,
      );
    };
  }, [videoId, useMutedFallback]);

  return (
    <iframe
      ref={iframeRef}
      key={`${videoId}-${useMutedFallback ? "muted" : "sound"}`}
      src={playerSrc}
      title={title}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowFullScreen
      className={`aspect-[9/16] h-[min(80vh,720px)] w-[min(calc(min(80vh,720px)*9/16),100%)] max-w-full border-0 bg-black ${className}`}
    />
  );
}
