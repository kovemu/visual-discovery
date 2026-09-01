import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImportedWorkRow } from "@/lib/picks/importYouTubeWork";
import { classifyWorksSubjectsSafe } from "@/lib/subjects/classifyWorks.server";
import {
  asOptionalOEmbedString,
  fetchTikTokOEmbed,
} from "@/lib/tiktok/fetchTikTokOEmbed";
import { isPermanentTikTokThumbnailUrl } from "@/lib/tiktok/cacheTikTokThumbnail";
import { resolveTikTokThumbnailUrl } from "@/lib/tiktok/resolveTikTokThumbnailUrl";

export async function findTikTokWork(
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
    .eq("source", "tiktok")
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

export async function createImportedTikTokWork(
  supabase: SupabaseClient,
  params: {
    videoId: string;
    canonicalUrl: string;
    title: string | null;
    description: string | null;
    thumbnailUrl: string | null;
  },
) {
  const { data, error } = await supabase
    .from("works")
    .insert({
      artist_id: null,
      type: "video",
      source: "tiktok",
      source_id: params.videoId,
      source_url: params.canonicalUrl,
      title: params.title,
      description: params.description,
      thumbnail_url: params.thumbnailUrl,
      published_at: new Date().toISOString(),
      duration_seconds: null,
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

  const work = data as ImportedWorkRow;
  await classifyWorksSubjectsSafe(supabase, [work.id]);

  return {
    work,
    error: null,
  };
}

export async function resolveImportedTikTokWork(
  supabase: SupabaseClient,
  params: {
    videoId: string;
    canonicalUrl: string;
  },
) {
  const found = await findTikTokWork(
    supabase,
    params.videoId,
  );

  if (found.error) {
    return {
      work: null,
      error: found.error,
      unavailable: false,
    };
  }

  const existing = found.work;

  if (
    existing &&
    isPermanentTikTokThumbnailUrl(
      existing.thumbnail_url,
    )
  ) {
    return {
      work: existing,
      error: null,
      unavailable: false,
    };
  }

  const oembed = await fetchTikTokOEmbed(
    params.canonicalUrl,
  );

  if (!oembed.ok) {
    if (existing) {
      return {
        work: existing,
        error: null,
        unavailable: false,
      };
    }

    return {
      work: null,
      error: null,
      unavailable: true,
    };
  }

  const title =
    asOptionalOEmbedString(oembed.data.title) ??
    `TikTok video ${params.videoId}`;
  const thumbnailUrl =
    await resolveTikTokThumbnailUrl({
      videoId: params.videoId,
      incomingThumbnail:
        asOptionalOEmbedString(
          oembed.data.thumbnail_url,
        ),
      existingThumbnail:
        existing?.thumbnail_url ?? null,
    });

  if (existing) {
    const nextThumbnail =
      thumbnailUrl ??
      (isPermanentTikTokThumbnailUrl(
        existing.thumbnail_url,
      )
        ? existing.thumbnail_url
        : null);

    if (nextThumbnail !== existing.thumbnail_url) {
      const { error: updateError } = await supabase
        .from("works")
        .update({
          thumbnail_url: nextThumbnail,
        })
        .eq("id", existing.id)
        .eq("source", "tiktok");

      if (updateError) {
        console.error(
          "IMPORT TIKTOK THUMBNAIL UPDATE ERROR:",
          updateError,
        );

        return {
          work: {
            ...existing,
            thumbnail_url: isPermanentTikTokThumbnailUrl(
              existing.thumbnail_url,
            )
              ? existing.thumbnail_url
              : null,
          },
          error: null,
          unavailable: false,
        };
      }

      return {
        work: {
          ...existing,
          thumbnail_url: nextThumbnail,
        },
        error: null,
        unavailable: false,
      };
    }

    return {
      work: existing,
      error: null,
      unavailable: false,
    };
  }

  const created = await createImportedTikTokWork(
    supabase,
    {
      videoId: params.videoId,
      canonicalUrl: params.canonicalUrl,
      title,
      description: title,
      thumbnailUrl,
    },
  );

  if (created.error) {
    const retry = await findTikTokWork(
      supabase,
      params.videoId,
    );

    if (retry.work) {
      return {
        work: retry.work,
        error: null,
        unavailable: false,
      };
    }

    return {
      work: null,
      error: created.error,
      unavailable: false,
    };
  }

  return {
    work: created.work,
    error: null,
    unavailable: false,
  };
}
