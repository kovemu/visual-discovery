import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import type { FeedItem } from "@/components/discover/DiscoverFeed";

export async function enrichFeedItemsWithPickCounts(
  works: FeedItem[],
): Promise<FeedItem[]> {
  if (works.length === 0) {
    return works;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return works.map((work) => ({
      ...work,
      pickCount: 0,
    }));
  }

  const workIds = works
    .map((work) => Number(work.id))
    .filter(
      (workId) =>
        Number.isInteger(workId) && workId > 0,
    );

  if (workIds.length === 0) {
    return works;
  }

  const supabaseAdmin = createServiceClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { data, error } = await supabaseAdmin
    .from("work_picks")
    .select("work_id")
    .in("work_id", workIds);

  if (error) {
    console.error("LOAD DISCOVER PICK COUNTS ERROR:", error.message);

    return works.map((work) => ({
      ...work,
      pickCount: 0,
    }));
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const key = String(row.work_id);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return works.map((work) => ({
    ...work,
    pickCount: counts.get(work.id) ?? 0,
  }));
}
