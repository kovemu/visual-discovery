import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getKstDayBounds(now = new Date()) {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  const startShiftedMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  const start = new Date(startShiftedMs - KST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

export async function GET() {
  const { start, end } = getKstDayBounds();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("works")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("featured", false)
    .eq("discover_eligible", true)
    .gte("discover_added_at", start.toISOString())
    .lt("discover_added_at", end.toISOString());

  if (error) {
    console.error("LOAD TODAY UPDATE COUNT ERROR:", error.message);
    return NextResponse.json(
      { error: "Failed to load update count." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { count: count ?? 0 },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
