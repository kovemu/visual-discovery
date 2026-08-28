import {
  getModalRotatedMediaStyle,
  getThumbnailRotatedMediaStyle,
  normalizeRotationDegrees,
  ROTATED_MEDIA_WRAPPER_CLASS,
} from "@/lib/works/workRotation";

type RotatedWorkThumbnailProps = {
  src: string;
  alt?: string;
  rotationDegrees?: unknown;
  layout?: "thumbnail" | "modal";
  imgClassName?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  draggable?: boolean;
};

export default function RotatedWorkThumbnail({
  src,
  alt = "",
  rotationDegrees = 0,
  layout = "thumbnail",
  imgClassName = "h-full w-full object-cover",
  referrerPolicy,
  draggable = false,
}: RotatedWorkThumbnailProps) {
  const rotation = normalizeRotationDegrees(
    rotationDegrees,
  );

  if (rotation === 0) {
    return (
      <img
        src={src}
        alt={alt}
        draggable={draggable}
        referrerPolicy={referrerPolicy}
        className={imgClassName}
      />
    );
  }

  if (layout === "modal") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <div className="relative aspect-[9/16] h-full w-auto max-w-full overflow-hidden bg-black">
          <img
            src={src}
            alt={alt}
            draggable={draggable}
            referrerPolicy={referrerPolicy}
            className="object-contain"
            style={getModalRotatedMediaStyle(rotation)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={ROTATED_MEDIA_WRAPPER_CLASS}>
      <img
        src={src}
        alt={alt}
        draggable={draggable}
        referrerPolicy={referrerPolicy}
        className="object-contain"
        style={getThumbnailRotatedMediaStyle(rotation)}
      />
    </div>
  );
}
