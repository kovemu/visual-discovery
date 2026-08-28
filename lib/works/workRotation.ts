import type { CSSProperties } from "react";

export type WorkRotationDegrees = 0 | 90 | 270;

export const WORK_ROTATION_OPTIONS: WorkRotationDegrees[] = [
  0, 90, 270,
];

export const ROTATED_MEDIA_WRAPPER_CLASS =
  "relative h-full w-full overflow-hidden bg-black";

export function normalizeRotationDegrees(
  value: unknown,
): WorkRotationDegrees {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" &&
          value.trim()
        ? Number(value)
        : 0;

  if (parsed === 90) {
    return 90;
  }

  if (parsed === 270) {
    return 270;
  }

  return 0;
}

export function getThumbnailRotatedMediaStyle(
  rotationDegrees: WorkRotationDegrees,
): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "232.3333%",
    height: "auto",
    aspectRatio: "16 / 9",
    maxWidth: "none",
    maxHeight: "none",
    transform: `translate(-50%, -50%) rotate(${rotationDegrees}deg)`,
    transformOrigin: "center center",
  };
}

export function getModalRotatedMediaStyle(
  rotationDegrees: WorkRotationDegrees,
): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "177.7778%",
    height: "56.25%",
    transform: `translate(-50%, -50%) rotate(${rotationDegrees}deg)`,
    transformOrigin: "center center",
  };
}

export function isRotatedMedia(
  rotationDegrees: unknown,
): boolean {
  return normalizeRotationDegrees(rotationDegrees) !== 0;
}
