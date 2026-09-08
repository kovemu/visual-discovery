import { NextRequest, NextResponse } from "next/server";

import type { FeedItem } from "@/components/discover/DiscoverFeed";
import type { CreatorCategory } from "@/lib/creator/creatorCategories";
import {
  parseDiscoverCategoriesParam,
} from "@/lib/discover/discoverCategorySelection";
import { enrichFeedItemsWithPickCounts } from "@/lib/discover/enrichFeedPickCounts";
import { parseDiscoverSubjectId } from "@/lib/discover/discoverSubjectFilter";
import { createClient } from "@/lib/supabase/server";
import { normalizeRotationDegrees } from "@/lib/works/workRotation";

const PAGE_SIZE = 36;

const RECENT_SELECT = `
  id,
  artist_id,
  type,
  source,
  source_id,
  source_url,
  title,
  description,
  thumbnail_url,
  published_at,
  duration_seconds,
  discover_category,
  rotation_degrees,
  thumbnail_rotation_degrees,
  artist_name,
  artist_category,
  artist_tags,
  effective_category,
  discover_added_at
`;

type RecentRow = {
  id: number;
  artist_id: string | null;
  type: string;
  source: string;
  source_id: string | null;
  source_url: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  discover_category: string | null;
  rotation_degrees: number | null;
  thumbnail_rotation_degrees: number | null;
  artist_name: string | null;
  artist_category: string | null;
  artist_tags: string[] | null;
  effective_category: string | null;
  discover_added_at: string | null;
};

function parsePage(value: string | null) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(1000, Math.max(0, Math.floor(parsed)));
}

function resolveCategories(
  request: NextRequest,
): CreatorCategory[] | null {
  const raw = request.nextUrl.searchParams.get("categories");

  if (raw === null || raw === "all") {
    return null;
  }

  return parseDiscoverCategoriesParam(raw);
}

function applyCategoryFilter<
  T extends {
    eq: (column: string, value: string) => T;
    in: (column: string, values: readonly string[]) => T;
  },
>(query: T, categories: CreatorCategory[] | null): T {
  if (!categories || categories.length === 0) {
    return query;
  }

  if (categories.length === 1) {
    return query.eq("effective_category", categories[0]);
  }

  return query.in("effective_category", categories);
}

function rowToFeedItem(row: RecentRow): FeedItem | null {
  if (
    (row.source === "youtube" || row.source === "tiktok") &&
    !row.source_id
  ) {
    return null;
  }

  if (
    row.source !== "youtube" &&
    row.source !== "tiktok" &&
    !row.thumbnail_url?.trim() &&
    !row.source_url?.trim()
  ) {
    return null;
  }

  const rawCategory = (
    row.effective_category ??
    row.discover_category ??
    row.artist_category ??
    ""
  ).trim();
  const category = rawCategory
    ? rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1)
    : "";
  const artistId = row.artist_id ?? undefined;
  const artistName = row.artist_name ?? undefined;
  const common = {
    id: String(row.id),
    artistId,
    artistName,
    category,
    artistTags: row.artist_tags ?? [],
    source: row.source,
    title: row.title,
    description: row.description,
    caption: row.description ?? row.title ?? null,
    sourceUrl: row.source_url,
    artistUrl: artistId ? `/creator/${artistId}` : undefined,
    durationSeconds:
      typeof row.duration_seconds === "number" &&
      row.duration_seconds > 0
        ? row.duration_seconds
        : undefined,
    rotationDegrees: normalizeRotationDegrees(row.rotation_degrees),
    thumbnailRotationDegrees: normalizeRotationDegrees(
      row.thumbnail_rotation_degrees,
    ),
    discoverAddedAt: row.discover_added_at ?? undefined,
  } satisfies Partial<FeedItem>;

  if (row.source === "youtube") {
    return {
      ...common,
      type: "youtube",
      videoId: row.source_id ?? undefined,
      image: row.thumbnail_url ?? undefined,
    } as FeedItem;
  }

  if (row.source === "tiktok") {
    return {
      ...common,
      type: "tiktok",
      videoId: row.source_id ?? undefined,
      image: row.thumbnail_url ?? undefined,
    } as FeedItem;
  }

  return {
    ...common,
    type: "image",
    image: row.thumbnail_url ?? row.source_url,
  } as FeedItem;
}

export async function GET(request: NextRequest) {
  const page = parsePage(request.nextUrl.searchParams.get("page"));
  const categories = resolveCategories(request);
  const subjectId = parseDiscoverSubjectId(
    request.nextUrl.searchParams.get("subjectId"),
  );
  const supabase = await createClient();

  let subjectWorkIds: number[] | null = null;

  if (subjectId) {
    const { data, error } = await supabase
      .from("work_subjects")
      .select("work_id")
      .eq("subject_id", subjectId)
      .limit(2000);

    if (error) {
      console.error("LOAD RECENT SUBJECT IDS ERROR:", error.message);
      return NextResponse.json(
        { works: [], nextPage: page + 1, hasMore: false },
        { status: 200 },
      );
    }

    subjectWorkIds = Array.from(
      new Set(
        (data ?? [])
          .map((row) => Number(row.work_id))
          .filter(
            (workId) =>
              Number.isInteger(workId) && workId > 0,
          ),
      ),
    );

    if (subjectWorkIds.length === 0) {
      return NextResponse.json({
        works: [],
        nextPage: page + 1,
        hasMore: false,
      });
    }
  }

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("discover_works_effective")
    .select(RECENT_SELECT)
    .eq("featured", false)
    .eq("discover_eligible", true);

  query = applyCategoryFilter(query, categories);

  if (subjectWorkIds) {
    query = query.in("id", subjectWorkIds);
  }

  const { data, error } = await query
    .order("discover_added_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("LOAD RECENT DISCOVER ERROR:", error.message);
    return NextResponse.json(
      { error: "Failed to load recent clips." },
      { status: 500 },
    );
  }

  const mapped = ((data ?? []) as unknown as RecentRow[])
    .map(rowToFeedItem)
    .filter((work): work is FeedItem => work !== null);
  const works = await enrichFeedItemsWithPickCounts(mapped);

  return NextResponse.json({
    works,
    nextPage: page + 1,
    hasMore: (data ?? []).length === PAGE_SIZE,
  });
}
