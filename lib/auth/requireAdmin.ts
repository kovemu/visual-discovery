import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isAnonymousUser } from "@/lib/auth/userKind";
import { createClient } from "@/lib/supabase/server";

export type AdminAuthResult =
  | {
      ok: true;
      user: User;
    }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden";
    };

function getAdminUserIds() {
  return (
    process.env.KOVEMU_ADMIN_USER_IDS
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? []
  );
}

export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || isAnonymousUser(user)) {
    return {
      ok: false,
      reason: "unauthenticated",
    };
  }

  const adminIds = getAdminUserIds();

  if (!adminIds.includes(user.id)) {
    return {
      ok: false,
      reason: "forbidden",
    };
  }

  return {
    ok: true,
    user,
  };
}

export function adminAuthErrorResponse(
  auth: Extract<AdminAuthResult, { ok: false }>,
) {
  return NextResponse.json(
    {
      error:
        auth.reason === "unauthenticated"
          ? "Unauthorized"
          : "Forbidden",
    },
    {
      status:
        auth.reason === "unauthenticated"
          ? 401
          : 403,
    },
  );
}
