"use client";

import { useEffect, useRef, useState } from "react";

import {
  normalizeRotationDegrees,
  type WorkRotationDegrees,
} from "@/lib/works/workRotation";

type RotatedWorkVideoProps = {
  videoId: string;
  title: string;
  rotationDegrees?: unknown;
  className?: string;
};

type PaneSize = {
  width: number;
  height: number;
};

export default function RotatedWorkVideo({
  videoId,
  title,
  rotationDegrees = 0,
  className = "h-full max-h-full w-full max-w-full border-0 md:aspect-[9/16] md:max-h-[80vh] md:w-full",
}: RotatedWorkVideoProps) {
  const rotation =
    normalizeRotationDegrees(rotationDegrees);

  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;

  // 일반 영상은 기존 동작 그대로 유지
  if (rotation === 0) {
    return (
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={className}
      />
    );
  }

  return (
    <RotatedModalIframe
      src={src}
      title={title}
      rotation={rotation}
    />
  );
}

function RotatedModalIframe({
  src,
  title,
  rotation,
}: {
  src: string;
  title: string;
  rotation: Exclude<
    WorkRotationDegrees,
    0
  >;
}) {
  const paneRef =
    useRef<HTMLDivElement>(null);

  const [paneSize, setPaneSize] =
    useState<PaneSize | null>(null);

  useEffect(() => {
    const pane = paneRef.current;

    if (!pane) {
      return;
    }

    const updateSize = () => {
      const rect =
        pane.getBoundingClientRect();

      const width = rect.width;
      const height = rect.height;

      if (width <= 0 || height <= 0) {
        return;
      }

      setPaneSize((current) => {
        if (
          current &&
          Math.abs(
            current.width - width,
          ) < 0.5 &&
          Math.abs(
            current.height - height,
          ) < 0.5
        ) {
          return current;
        }

        return {
          width,
          height,
        };
      });
    };

    updateSize();

    const observer =
      new ResizeObserver(updateSize);

    observer.observe(pane);

    return () => {
      observer.disconnect();
    };
  }, []);

  let iframeWidth = 0;
  let iframeHeight = 0;

  if (paneSize) {
    /*
     * 회전 후 화면은 9:16 portrait가 된다.
     *
     * 먼저 media pane 안에 들어갈 수 있는
     * 가장 큰 9:16 화면 크기를 계산한다.
     */
    const displayHeight = Math.min(
      paneSize.height,
      paneSize.width * (16 / 9),
    );

    const displayWidth =
      displayHeight * (9 / 16);

    /*
     * iframe 자체는 원래 16:9다.
     *
     * 90도 회전하면 width/height가 뒤집히므로:
     *
     * iframe before rotation:
     *   width  = displayHeight
     *   height = displayWidth
     *
     * after rotation:
     *   width  = displayWidth
     *   height = displayHeight
     */
    iframeWidth = displayHeight;
    iframeHeight = displayWidth;
  }

  return (
    <div
      ref={paneRef}
      className="relative h-full w-full overflow-hidden bg-black"
    >
      {paneSize ? (
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute border-0"
          style={{
            left: "50%",
            top: "50%",
            width: iframeWidth,
            height: iframeHeight,
            maxWidth: "none",
            maxHeight: "none",
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            transformOrigin:
              "center center",
          }}
        />
      ) : null}
    </div>
  );
}