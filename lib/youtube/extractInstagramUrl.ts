const RESERVED_INSTAGRAM_PATHS =
  new Set([
    "p",
    "reel",
    "reels",
    "stories",
    "explore",
    "accounts",
    "legal",
    "tv",
    "direct",
  ]);

const INSTAGRAM_URL_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?/gi;

export function extractInstagramUrl(
  text: string,
) {
  if (!text.trim()) {
    return "";
  }

  for (const match of text.matchAll(
    INSTAGRAM_URL_PATTERN,
  )) {
    const username = match[1];

    if (
      !username ||
      RESERVED_INSTAGRAM_PATHS.has(
        username.toLowerCase(),
      )
    ) {
      continue;
    }

    return `https://www.instagram.com/${username}`;
  }

  return "";
}
