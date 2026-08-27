import type { User } from "@supabase/supabase-js";

type AuthUser = User & {
  is_anonymous?: boolean;
};

export function isAnonymousUser(
  user: User | null | undefined,
): boolean {
  if (!user) {
    return false;
  }

  const authUser = user as AuthUser;

  if (typeof authUser.is_anonymous === "boolean") {
    return authUser.is_anonymous;
  }

  return (user.identities ?? []).some(
    (identity) => identity.provider === "anonymous",
  );
}

export function isRealAccountUser(
  user: User | null | undefined,
): user is User {
  return Boolean(user) && !isAnonymousUser(user);
}
