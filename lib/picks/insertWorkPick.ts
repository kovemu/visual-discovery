import type { SupabaseClient } from "@supabase/supabase-js";

type InsertWorkPickParams = {
  userId: string;
  workId: string;
  artistId?: string | null;
};

function asSortOrder(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export async function insertWorkPick(
  supabase: SupabaseClient,
  params: InsertWorkPickParams,
) {
  const { data: frontRow, error: frontError } =
    await supabase
      .from("work_picks")
      .select("sort_order")
      .eq("user_id", params.userId)
      .not("sort_order", "is", null)
      .order("sort_order", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

  if (frontError) {
    return { error: frontError };
  }

  const frontOrder =
    asSortOrder(frontRow?.sort_order) ?? 0;

  return supabase.from("work_picks").insert({
    user_id: params.userId,
    work_id: params.workId,
    artist_id: params.artistId || null,
    sort_order: frontOrder - 1,
  });
}
