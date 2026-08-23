const TIKTOK_VIDEO_PATH =
  /^\/(@[^/]+)\/video\/(\d+)\/?$/;

function parseTikTokUrl(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(
    trimmed,
  )
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (hostname !== "tiktok.com") {
      return null;
    }

    const match = parsed.pathname.match(
      TIKTOK_VIDEO_PATH,
    );

    if (!match) {
      return null;
    }

    return {
      handle: match[1],
      videoId: match[2],
    };
  } catch {
    return null;
  }
}

export function extractTikTokVideoId(
  input: string | null | undefined,
): string | null {
  if (!input) {
    return null;
  }

  return parseTikTokUrl(input)?.videoId ?? null;
}

export function buildCanonicalTikTokUrl(
  input: string | null | undefined,
): string | null {
  const parsed = input ? parseTikTokUrl(input) : null;

  if (!parsed) {
    return null;
  }

  return `https://www.tiktok.com/${parsed.handle}/video/${parsed.videoId}`;
}
