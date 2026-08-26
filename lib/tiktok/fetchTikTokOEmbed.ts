const TIKTOK_OEMBED_ENDPOINT =
  "https://www.tiktok.com/oembed";

export type TikTokOEmbedFetchResult =
  | {
      ok: true;
      data: Record<string, unknown>;
    }
  | {
      ok: false;
      status: number;
    };

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(
  value: string | null,
) {
  if (!value?.trim()) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const dateMs = Date.parse(value);

  if (Number.isFinite(dateMs)) {
    const delayMs = dateMs - Date.now();

    return delayMs > 0 ? delayMs : 0;
  }

  return null;
}

export function asOptionalOEmbedString(
  value: unknown,
) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

export async function fetchTikTokOEmbed(
  canonicalUrl: string,
): Promise<TikTokOEmbedFetchResult> {
  const oembedUrl = new URL(TIKTOK_OEMBED_ENDPOINT);
  oembedUrl.searchParams.set("url", canonicalUrl);

  let response = await fetch(oembedUrl, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(
      response.headers.get("retry-after"),
    );

    if (retryAfterMs != null) {
      await sleep(retryAfterMs);

      response = await fetch(oembedUrl, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });
    }
  }

  if (response.ok) {
    return {
      ok: true,
      data: (await response.json()) as Record<
        string,
        unknown
      >,
    };
  }

  return {
    ok: false,
    status: response.status,
  };
}
