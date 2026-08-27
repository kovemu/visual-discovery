import type { SupabaseClient } from "@supabase/supabase-js";

import { isAnonymousUser, isRealAccountUser } from "@/lib/auth/userKind";

export type AnonymousPickSnapshot = {
  work_id: string;
  artist_id: string | null;
  sort_order: number | null;
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

export async function captureAnonymousPicks(
  supabase: SupabaseClient,
): Promise<AnonymousPickSnapshot[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAnonymousUser(user) || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("work_picks")
    .select("work_id, artist_id, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", {
      ascending: true,
      nullsFirst: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("CAPTURE ANONYMOUS PICKS ERROR:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    work_id: String(row.work_id),
    artist_id:
      typeof row.artist_id === "string" &&
      row.artist_id.length > 0
        ? row.artist_id
        : null,
    sort_order: asSortOrder(row.sort_order),
  }));
}

export async function mergeAnonymousPicks(
  supabase: SupabaseClient,
  snapshots: AnonymousPickSnapshot[],
) {
  if (snapshots.length === 0) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isRealAccountUser(user) || !user) {
    return;
  }

  const { data: existingRows, error: existingError } =
    await supabase
      .from("work_picks")
      .select("work_id")
      .eq("user_id", user.id);

  if (existingError) {
    console.error(
      "MERGE ANONYMOUS PICKS LOAD ERROR:",
      existingError,
    );
    return;
  }

  const existingIds = new Set(
    (existingRows ?? []).map((row) =>
      String(row.work_id),
    ),
  );

  const toInsert = snapshots.filter(
    (snapshot) => !existingIds.has(snapshot.work_id),
  );

  if (toInsert.length === 0) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new Event("kovemu-picks-changed"),
      );
    }
    return;
  }

  const { data: frontRow } = await supabase
    .from("work_picks")
    .select("sort_order")
    .eq("user_id", user.id)
    .not("sort_order", "is", null)
    .order("sort_order", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  let nextOrder =
    (asSortOrder(frontRow?.sort_order) ?? 0) - 1;

  for (const snapshot of toInsert) {
    const { error } = await supabase
      .from("work_picks")
      .insert({
        user_id: user.id,
        work_id: snapshot.work_id,
        artist_id: snapshot.artist_id,
        sort_order: nextOrder,
      });

    if (!error) {
      nextOrder -= 1;
      continue;
    }

    if (error.code === "23505") {
      continue;
    }

    console.error(
      "MERGE ANONYMOUS PICK INSERT ERROR:",
      error,
    );
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("kovemu-picks-changed"),
    );
  }
}
