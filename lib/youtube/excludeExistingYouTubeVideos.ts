import type { SupabaseClient } from "@supabase/supabase-js";

const SOURCE_ID_BATCH_SIZE = 100;

export async function getExistingYouTubeSourceIds(
  supabase: SupabaseClient,
  videoIds: readonly string[],
): Promise<Set<string>> {
  const uniqueIds = Array.from(
    new Set(
      videoIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

  if (uniqueIds.length === 0) {
    return new Set();
  }

  const existing = new Set<string>();

  for (
    let index = 0;
    index < uniqueIds.length;
    index += SOURCE_ID_BATCH_SIZE
  ) {
    const batch = uniqueIds.slice(
      index,
      index + SOURCE_ID_BATCH_SIZE,
    );

    const { data, error } = await supabase
      .from("works")
      .select("source_id")
      .eq("source", "youtube")
      .in("source_id", batch);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      if (
        typeof row.source_id === "string" &&
        row.source_id
      ) {
        existing.add(row.source_id);
      }
    }
  }

  return existing;
}

export function excludeExistingYouTubeVideos<
  T extends { id: string },
>(
  videos: T[],
  existingSourceIds: Set<string>,
): T[] {
  if (existingSourceIds.size === 0) {
    return videos;
  }

  return videos.filter(
    (video) => !existingSourceIds.has(video.id),
  );
}

export async function filterOutExistingYouTubeVideos<
  T extends { id: string },
>(
  supabase: SupabaseClient,
  videos: T[],
): Promise<T[]> {
  const existingSourceIds =
    await getExistingYouTubeSourceIds(
      supabase,
      videos.map((video) => video.id),
    );

  return excludeExistingYouTubeVideos(
    videos,
    existingSourceIds,
  );
}
