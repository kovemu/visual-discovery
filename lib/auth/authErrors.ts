import type { User } from "@supabase/supabase-js";

const MIN_PASSWORD_LENGTH = 6;

type AuthLikeError = {
  code?: string;
  message?: string;
  status?: number;
};

function asText(error: AuthLikeError) {
  return `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
}

export function isAlreadyRegisteredError(error: AuthLikeError) {
  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();

  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("user already registered") ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("email address is already")
  );
}

export function isObfuscatedExistingSignup(
  user: User | null | undefined,
) {
  if (!user) {
    return false;
  }

  return (user.identities ?? []).length === 0;
}

export function mapSignupError(error: AuthLikeError) {
  if (isAlreadyRegisteredError(error)) {
    return {
      type: "already_registered" as const,
    };
  }

  const text = asText(error);
  const code = (error.code ?? "").toLowerCase();

  if (
    code === "weak_password" ||
    text.includes("password should be at least") ||
    text.includes("password must be at least") ||
    text.includes("weak password") ||
    (text.includes("password") && text.includes("6"))
  ) {
    return {
      type: "message" as const,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (
    text.includes("valid email") ||
    text.includes("invalid email") ||
    text.includes("unable to validate email") ||
    code === "validation_failed"
  ) {
    return {
      type: "message" as const,
      message: "Enter a valid email address.",
    };
  }

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    text.includes("rate limit") ||
    text.includes("too many requests")
  ) {
    return {
      type: "message" as const,
      message: "Too many attempts. Please try again later.",
    };
  }

  console.error("SIGNUP AUTH ERROR:", {
    code: error.code,
    status: error.status,
  });

  return {
    type: "message" as const,
    message: "Could not create your account. Please try again.",
  };
}

export function mapLoginError(error: AuthLikeError) {
  const code = (error.code ?? "").toLowerCase();
  const text = asText(error);

  if (
    code === "email_not_confirmed" ||
    text.includes("email not confirmed")
  ) {
    return "Please confirm your email before logging in.";
  }

  if (
    code === "invalid_credentials" ||
    text.includes("invalid login credentials") ||
    text.includes("invalid credentials")
  ) {
    return "Incorrect email or password.";
  }

  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    text.includes("rate limit") ||
    text.includes("too many requests")
  ) {
    return "Too many attempts. Please try again later.";
  }

  console.error("LOGIN AUTH ERROR:", {
    code: error.code,
    status: error.status,
  });

  return "Could not log in. Please try again.";
}

export function mapResetError(error: AuthLikeError) {
  const code = (error.code ?? "").toLowerCase();
  const text = asText(error);

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    text.includes("rate limit") ||
    text.includes("too many requests")
  ) {
    return "Too many attempts. Please try again later.";
  }

  if (
    text.includes("valid email") ||
    text.includes("invalid email")
  ) {
    return "Enter a valid email address.";
  }

  console.error("RESET PASSWORD AUTH ERROR:", {
    code: error.code,
    status: error.status,
  });

  return "Could not send a reset link. Please try again.";
}

export function mapPasswordUpdateError(error: AuthLikeError) {
  const code = (error.code ?? "").toLowerCase();
  const text = asText(error);

  if (
    code === "weak_password" ||
    text.includes("password should be at least") ||
    text.includes("password must be at least") ||
    text.includes("weak password")
  ) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (
    code === "same_password" ||
    text.includes("should be different from the old password")
  ) {
    return "Choose a password you have not used before.";
  }

  console.error("UPDATE PASSWORD AUTH ERROR:", {
    code: error.code,
    status: error.status,
  });

  return "Could not update your password. Please try again.";
}

export { MIN_PASSWORD_LENGTH };
