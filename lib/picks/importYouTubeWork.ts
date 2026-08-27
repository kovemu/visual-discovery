import type { SupabaseClient } from "@supabase/supabase-js";

import type { YouTubeVideoMeta } from "@/lib/youtube/fetchYouTubeVideo";

export type ImportedWorkRow = {
  id: number | string;
  source: string;
  source_id: string | null;
  source_url: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  discover_eligible: boolean;
  artist_id: string | null;
};

export async function findYouTubeWork(
  supabase: SupabaseClient,
  videoId: string,
) {
  const { data, error } = await supabase
    .from("works")
    .select(
      `
        id,
        source,
        source_id,
        source_url,
        title,
        description,
        thumbnail_url,
        duration_seconds,
        discover_eligible,
        artist_id
      `,
    )
    .eq("source", "youtube")
    .eq("source_id", videoId)
    .maybeSingle();

  if (error) {
    return { work: null, error };
  }

  return {
    work: (data as ImportedWorkRow | null) ?? null,
    error: null,
  };
}

export async function createImportedYouTubeWork(
  supabase: SupabaseClient,
  meta: YouTubeVideoMeta,
) {
  const { data, error } = await supabase
    .from("works")
    .insert({
      artist_id: null,
      type: "youtube",
      source: "youtube",
      source_id: meta.videoId,
      source_url: meta.canonicalUrl,
      title: meta.title,
      description: meta.description,
      thumbnail_url: meta.thumbnailUrl,
      published_at: meta.publishedAt,
      duration_seconds: meta.durationSeconds,
      featured: false,
      discover_eligible: false,
    })
    .select(
      `
        id,
        source,
        source_id,
        source_url,
        title,
        description,
        thumbnail_url,
        duration_seconds,
        discover_eligible,
        artist_id
      `,
    )
    .single();

  if (error) {
    return { work: null, error };
  }

  return {
    work: data as ImportedWorkRow,
    error: null,
  };
}

export async function ensurePendingClipSubmission(
  supabase: SupabaseClient,
  params: {
    userId: string;
    work: ImportedWorkRow;
    meta: YouTubeVideoMeta;
  },
) {
  if (params.work.discover_eligible) {
    return { error: null };
  }

  const { data: existing, error: existingError } =
    await supabase
      .from("clip_submissions")
      .select("id, status")
      .eq("source_url", params.meta.canonicalUrl)
      .in("status", ["pending", "approved"])
      .maybeSingle();

  if (existingError) {
    return { error: existingError };
  }

  if (existing) {
    return { error: null };
  }

  const { error } = await supabase
    .from("clip_submissions")
    .insert({
      user_id: params.userId,
      source_url: params.meta.canonicalUrl,
      source_type: "youtube",
      source_id: params.meta.videoId,
      title: params.meta.title,
      description: params.meta.description,
      thumbnail_url: params.meta.thumbnailUrl,
      duration_seconds: params.meta.durationSeconds,
      confirmed_18_plus: true,
      status: "pending",
      work_id: params.work.id,
    });

  return { error };
}
