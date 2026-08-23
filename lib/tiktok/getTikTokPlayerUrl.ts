type TikTokPlayerUrlOptions = {
  autoplay?: boolean;
  muted?: boolean;
};

export function getTikTokPlayerUrl(
  videoId: string,
  options: TikTokPlayerUrlOptions = {},
) {
  const url = new URL(
    `https://www.tiktok.com/player/v1/${videoId}`,
  );

  if (options.autoplay ?? true) {
    url.searchParams.set("autoplay", "1");
  }

  url.searchParams.set(
    "muted",
    options.muted ? "1" : "0",
  );

  return url.toString();
}
