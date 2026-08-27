import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

export class PickSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PickSessionError";
  }
}

function anonymousSignInMessage(
  error: {
    code?: string;
    message?: string;
  } | null,
) {
  const code = (error?.code ?? "").toLowerCase();
  const message = (error?.message ?? "").toLowerCase();

  if (
    code === "anonymous_provider_disabled" ||
    message.includes("anonymous sign-ins are disabled") ||
    message.includes("anonymous provider is disabled")
  ) {
    console.error(
      "ANONYMOUS SIGN-IN DISABLED: Enable Anonymous Sign-Ins in Supabase Auth providers.",
      error,
    );

    return "Could not save this pick.";
  }

  console.error("ANONYMOUS SIGN-IN ERROR:", error);

  return "Could not save this pick.";
}

export async function ensurePickSession(): Promise<User> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    return session.user;
  }

  const { data, error } =
    await supabase.auth.signInAnonymously();

  if (error || !data.user) {
    throw new PickSessionError(
      anonymousSignInMessage(error),
    );
  }

  return data.user;
}
