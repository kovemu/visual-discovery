import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  PRODUCT_EVENT_NAMES,
  type ProductEventName,
} from "@/lib/analytics/trackProductEvent";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/isUuid";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_EVENT_NAMES = new Set<string>(
  PRODUCT_EVENT_NAMES,
);

function isValidSessionId(value: unknown) {
  return (
    typeof value === "string" &&
    isUuid(value)
  );
}

function isValidWorkId(value: unknown) {
  return (
    typeof value === "string" &&
    /^\d+$/.test(value)
  );
}

function sanitizeMetadata(
  eventName: ProductEventName,
  metadata: unknown,
) {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return {};
  }

  const raw = metadata as Record<
    string,
    unknown
  >;

  if (eventName === "pass_next") {
    if (
      raw.action === "pass" ||
      raw.action === "next"
    ) {
      return { action: raw.action };
    }

    return {};
  }

  if (eventName === "save") {
    if (
      raw.action === "save" ||
      raw.action === "unsave"
    ) {
      return { action: raw.action };
    }

    return {};
  }

  if (
    eventName === "card_open" ||
    eventName === "original_click"
  ) {
    const sanitized: Record<
      string,
      string
    > = {};

    if (
      raw.source === "youtube" ||
      raw.source === "tiktok" ||
      raw.source === "image"
    ) {
      sanitized.source = raw.source;
    }

    return sanitized;
  }

  if (eventName === "next") {
    if (
      typeof raw.current_set_size ===
        "number" &&
      Number.isInteger(
        raw.current_set_size,
      ) &&
      raw.current_set_size >= 1 &&
      raw.current_set_size <= 24
    ) {
      return {
        current_set_size:
          raw.current_set_size,
      };
    }

    return {};
  }

  if (eventName === "discover_set_view") {
    const sanitized: Record<
      string,
      string | number
    > = {};

    if (
      typeof raw.types === "string" &&
      raw.types.length <= 32
    ) {
      sanitized.types = raw.types;
    }

    if (
      typeof raw.count === "number" &&
      Number.isInteger(raw.count) &&
      raw.count >= 0 &&
      raw.count <= 24
    ) {
      sanitized.count = raw.count;
    }

    return sanitized;
  }

  return {};
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Analytics is not configured." },
        { status: 500 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid payload." },
        { status: 400 },
      );
    }

    const payload = body as {
      event_name?: unknown;
      session_id?: unknown;
      artist_id?: unknown;
      work_id?: unknown;
      metadata?: unknown;
    };

    const eventName = payload.event_name;

    if (
      typeof eventName !== "string" ||
      !ALLOWED_EVENT_NAMES.has(eventName)
    ) {
      return NextResponse.json(
        { error: "Invalid event name." },
        { status: 400 },
      );
    }

    if (!isValidSessionId(payload.session_id)) {
      return NextResponse.json(
        { error: "Invalid session id." },
        { status: 400 },
      );
    }

    const artistId =
      payload.artist_id == null ||
      payload.artist_id === ""
        ? null
        : typeof payload.artist_id === "string" &&
            isUuid(payload.artist_id)
          ? payload.artist_id
          : null;

    if (
      payload.artist_id != null &&
      payload.artist_id !== "" &&
      !artistId
    ) {
      return NextResponse.json(
        { error: "Invalid artist id." },
        { status: 400 },
      );
    }

    const workId =
      payload.work_id == null ||
      payload.work_id === ""
        ? null
        : isValidWorkId(payload.work_id)
          ? payload.work_id
          : null;

    if (
      payload.work_id != null &&
      payload.work_id !== "" &&
      !workId
    ) {
      return NextResponse.json(
        { error: "Invalid work id." },
        { status: 400 },
      );
    }

    const authSupabase = await createClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

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

    const { error } = await supabaseAdmin
      .from("product_events")
      .insert({
        event_name: eventName,
        session_id: payload.session_id,
        user_id: user?.id ?? null,
        artist_id: artistId,
        work_id: workId,
        metadata: sanitizeMetadata(
          eventName as ProductEventName,
          payload.metadata,
        ),
      });

    if (error) {
      console.error("PRODUCT EVENT INSERT ERROR:", {
        event_name: eventName,
        reason: error.message,
      });

      return NextResponse.json(
        { error: "Failed to record event." },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PRODUCT EVENT UNEXPECTED ERROR:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
