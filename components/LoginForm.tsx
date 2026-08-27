"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import LegalModal, {
  type LegalModalType,
} from "@/components/legal/LegalModal";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import {
  isObfuscatedExistingSignup,
  mapLoginError,
  mapResetError,
  mapSignupError,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/authErrors";
import { getEmailRedirectTo } from "@/lib/auth/emailRedirect";
import { normalizeEmail } from "@/lib/auth/normalizeEmail";
import { createClient } from "@/lib/supabase/client";
import {
  captureAnonymousPicks,
  mergeAnonymousPicks,
} from "@/lib/picks/mergeAnonymousPicks";

type LoginFormProps = {
  onSuccess?: () => void;
  mode?: "login" | "signup";
  presentation?: "page" | "modal";
  accountCreated?: boolean;
  nextPath?: string;
  linkError?: boolean;
  onModeChange?: (
    mode: "login" | "signup",
  ) => void;
};

const SIGNUP_SUCCESS_MESSAGE =
  "Account created successfully. Log in to continue.";
const RESET_SENT_MESSAGE =
  "If an account exists for this email, we sent a reset link.";
const DUPLICATE_EMAIL_MESSAGE =
  "An account with this email already exists.";

const pageInputClassName =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-950 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#ffffff] [&:-webkit-autofill]:[-webkit-text-fill-color:#111827] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0_1000px_#ffffff] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0_1000px_#ffffff]";

const modalInputClassName =
  "h-11 w-full rounded-lg border border-zinc-800 bg-[#181818] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#181818] [&:-webkit-autofill]:[-webkit-text-fill-color:#ffffff] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0_1000px_#181818] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0_1000px_#181818]";

export default function LoginForm({
  onSuccess,
  mode = "login",
  presentation,
  accountCreated = false,
  nextPath,
  linkError = false,
  onModeChange,
}: LoginFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const inFlightRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");
  const [message, setMessage] = useState(
    linkError
      ? "This link is invalid or has expired."
      : "",
  );
  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");
  const [
    alreadyRegistered,
    setAlreadyRegistered,
  ] = useState(false);
  const [panel, setPanel] = useState<
    "auth" | "forgot"
  >("auth");
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] =
    useState<LegalModalType | null>(null);

  const resolvedPresentation =
    presentation ?? "page";
  const isModal =
    resolvedPresentation === "modal";
  const isSignup = mode === "signup";
  const showHeading =
    resolvedPresentation === "page" ||
    resolvedPresentation === "modal";
  const showFooter =
    resolvedPresentation === "page" ||
    resolvedPresentation === "modal";
  const inputClassName = isModal
    ? modalInputClassName
    : pageInputClassName;
  const accentLinkClass = isModal
    ? "font-semibold text-violet-400 transition hover:text-violet-300"
    : "font-semibold text-fuchsia-600 transition hover:text-fuchsia-700";

  const skipModeResetRef = useRef(true);

  useEffect(() => {
    if (!isSignup && accountCreated) {
      setSuccessMessage(
        SIGNUP_SUCCESS_MESSAGE,
      );
    }
  }, [isSignup, accountCreated]);

  useEffect(() => {
    if (skipModeResetRef.current) {
      skipModeResetRef.current = false;
      return;
    }

    inFlightRef.current = false;
    setLoading(false);
    setMessage("");
    setAlreadyRegistered(false);
    setConfirmPassword("");
    setPanel("auth");

    if (isSignup) {
      setSuccessMessage("");
    }
  }, [mode, isSignup]);

  function clearFeedback() {
    setMessage("");
    setAlreadyRegistered(false);
  }

  function finishAuthenticated() {
    setSuccessMessage("");

    if (onSuccess) {
      onSuccess();
      return;
    }

    router.push(nextPath || "/");
    router.refresh();
  }

  function applySignupError(error: {
    code?: string;
    message?: string;
  }) {
    const mapped = mapSignupError(error);

    if (mapped.type === "already_registered") {
      setAlreadyRegistered(true);
      return;
    }

    setMessage(mapped.message);
  }

  function validateJoin(normalizedEmail: string) {
    if (!normalizedEmail) {
      return "Enter a valid email address.";
    }

    if (!password) {
      return "Enter a password.";
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (!confirmPassword) {
      return "Confirm your password.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    return null;
  }

  function validateLogin(normalizedEmail: string) {
    if (!normalizedEmail) {
      return "Enter a valid email address.";
    }

    if (!password) {
      return "Enter a password.";
    }

    return null;
  }

  const signUp = async () => {
    const normalizedEmail = normalizeEmail(email);
    const validationError = validateJoin(normalizedEmail);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    clearFeedback();
    setSuccessMessage("");

    try {
      const anonymousPicks =
        await captureAnonymousPicks(
          supabase,
        );

      const { data, error } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });

      if (error) {
        applySignupError(error);
        return;
      }

      if (isObfuscatedExistingSignup(data.user)) {
        setAlreadyRegistered(true);
        return;
      }

      if (!data.session) {
        setMessage(
          "Could not create your account. Please try again.",
        );
        return;
      }

      trackProductEvent({
        event_name: "signup",
      });

      await mergeAnonymousPicks(
        supabase,
        anonymousPicks,
      );

      finishAuthenticated();
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const signIn = async () => {
    const normalizedEmail = normalizeEmail(email);
    const validationError = validateLogin(normalizedEmail);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    clearFeedback();

    try {
      const anonymousPicks =
        await captureAnonymousPicks(
          supabase,
        );

      const { error } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (error) {
        setMessage(mapLoginError(error));
        return;
      }

      await mergeAnonymousPicks(
        supabase,
        anonymousPicks,
      );

      finishAuthenticated();
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const sendResetLink = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setMessage("Enter a valid email address.");
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: getEmailRedirectTo(
              "/auth/update-password",
            ),
          },
        );

      if (error) {
        setMessage(mapResetError(error));
        return;
      }

      setSuccessMessage(RESET_SENT_MESSAGE);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (loading || inFlightRef.current) {
      return;
    }

    if (panel === "forgot") {
      await sendResetLink();
      return;
    }

    if (isSignup) {
      await signUp();
      return;
    }

    await signIn();
  };

  const emailId =
    resolvedPresentation === "modal"
      ? `modal-${mode}-email`
      : isSignup
        ? "join-email"
        : "login-email";
  const passwordId =
    resolvedPresentation === "modal"
      ? `modal-${mode}-password`
      : isSignup
        ? "join-password"
        : "login-password";
  const confirmPasswordId =
    resolvedPresentation === "modal"
      ? `modal-${mode}-confirm-password`
      : "join-confirm-password";

  const heading =
    panel === "forgot"
      ? "Reset password"
      : isSignup
        ? isModal
          ? "Join KOVEMU"
          : "Join Kovemu"
        : isModal
          ? "Log in"
          : "Welcome to Kovemu";

  const description =
    panel === "forgot"
      ? "Enter your email and we will send a reset link."
      : !isSignup
        ? isModal
          ? "Pick, save, and keep discovering."
          : "Discover Korean artists you'll love."
        : isModal
          ? null
          : "Discover and save artists you love.";

  function renderLoginCta(label = "Log in") {
    if (isModal) {
      return (
        <button
          type="button"
          onClick={() => {
            clearFeedback();
            setSuccessMessage("");
            setPanel("auth");
            onModeChange?.("login");
          }}
          className={accentLinkClass}
        >
          {label}
        </button>
      );
    }

    return (
      <Link href="/login" className={accentLinkClass}>
        {label}
      </Link>
    );
  }

  return (
    <div>
      {showHeading && (
        <>
          <h1
            id={
              isModal
                ? "auth-modal-title"
                : undefined
            }
            className={`text-center font-semibold tracking-tight ${
              isModal
                ? "text-xl text-white"
                : "text-2xl font-black text-gray-950"
            }`}
          >
            {heading}
          </h1>

          {description && (
            <p
              className={`mt-2 text-center text-sm leading-6 ${
                isModal
                  ? "text-zinc-500"
                  : "text-gray-500"
              }`}
            >
              {description}
            </p>
          )}
        </>
      )}

      <form
        onSubmit={handleSubmit}
        className={
          showHeading
            ? isModal
              ? "mt-6 space-y-4"
              : "mt-8 space-y-5"
            : "space-y-4"
        }
      >
          {!isSignup &&
            panel === "auth" &&
            successMessage && (
              <p
                className={
                  isModal
                    ? "rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm leading-5 text-violet-300"
                    : "rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 text-sm leading-5 text-fuchsia-700"
                }
              >
                {successMessage}
              </p>
            )}

          {panel === "forgot" && successMessage && (
            <p
              className={
                isModal
                  ? "rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm leading-5 text-violet-300"
                  : "rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 text-sm leading-5 text-fuchsia-700"
              }
            >
              {successMessage}
            </p>
          )}

          <div>
            <label
              htmlFor={emailId}
              className={`mb-2 block text-sm font-medium ${
                isModal
                  ? "text-zinc-300"
                  : "font-semibold text-gray-800"
              }`}
            >
              Email
            </label>

            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              required
              autoComplete="email"
              className={inputClassName}
            />
          </div>

          {panel === "auth" && (
            <div>
              <label
                htmlFor={passwordId}
                className={`mb-2 block text-sm font-medium ${
                  isModal
                    ? "text-zinc-300"
                    : "font-semibold text-gray-800"
                }`}
              >
                Password
              </label>

              <input
                id={passwordId}
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Password"
                required
                minLength={
                  isSignup ? MIN_PASSWORD_LENGTH : undefined
                }
                autoComplete={
                  isSignup
                    ? "new-password"
                    : "current-password"
                }
                className={inputClassName}
              />
            </div>
          )}

          {panel === "auth" && isSignup && (
            <div>
              <label
                htmlFor={confirmPasswordId}
                className={`mb-2 block text-sm font-medium ${
                  isModal
                    ? "text-zinc-300"
                    : "font-semibold text-gray-800"
                }`}
              >
                Confirm password
              </label>

              <input
                id={confirmPasswordId}
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                placeholder="Confirm password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                className={inputClassName}
              />
            </div>
          )}

          {panel === "auth" && !isSignup && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  clearFeedback();
                  setSuccessMessage("");
                  setPanel("forgot");
                }}
                className={`text-sm ${accentLinkClass}`}
              >
                Forgot password?
              </button>
            </div>
          )}

          {alreadyRegistered ? (
            <p className="text-sm leading-5 text-red-400">
              {DUPLICATE_EMAIL_MESSAGE}{" "}
              {renderLoginCta()} instead.
            </p>
          ) : (
            message && (
              <p className="text-sm leading-5 text-red-400">
                {message}
              </p>
            )
          )}

          <button
            type="submit"
            disabled={loading}
            className={
              isModal
                ? "h-11 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                : "h-12 w-full rounded-full bg-fuchsia-600 text-sm font-bold text-white transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {loading
              ? "Please wait..."
              : panel === "forgot"
                ? "Send reset link"
                : isSignup
                  ? "Join"
                  : "Log in"}
          </button>

          {panel === "auth" && isSignup && (
            <p
              className={`text-center text-xs leading-5 ${
                isModal
                  ? "text-zinc-500"
                  : "text-gray-500"
              }`}
            >
              By creating an account, you agree to our{" "}
              <button
                type="button"
                onClick={() => setLegalModal("terms")}
                className={accentLinkClass}
              >
                Terms
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={() => setLegalModal("privacy")}
                className={accentLinkClass}
              >
                Privacy Policy
              </button>
              .
            </p>
          )}

          {panel === "forgot" && (
            <p
              className={`text-center text-sm ${
                isModal ? "text-zinc-500" : "text-gray-500"
              }`}
            >
              {renderLoginCta("Back to log in")}
            </p>
          )}
        </form>

      {isSignup && legalModal && (
        <LegalModal
          type={legalModal}
          open
          onClose={() => setLegalModal(null)}
        />
      )}

      {showFooter && panel === "auth" && (
        <>
        <div
          className={`mt-6 text-center text-sm ${
            isModal
              ? "text-zinc-500"
              : "text-gray-500"
          }`}
        >
          {isModal ? (
            isSignup ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setSuccessMessage("");
                    onModeChange?.("login");
                  }}
                  className={accentLinkClass}
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                New to KOVEMU?{" "}
                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setSuccessMessage("");
                    onModeChange?.("signup");
                  }}
                  className={accentLinkClass}
                >
                  Join
                </button>
              </>
            )
          ) : isSignup ? (
            <>
              Already have an account?{" "}
              <Link
                href="/login"
                className={accentLinkClass}
              >
                Log in
              </Link>
            </>
          ) : (
            <>
              New to Kovemu?{" "}
              <Link
                href="/join"
                className={accentLinkClass}
              >
                Join
              </Link>
            </>
          )}
        </div>

        <div
          className={`mt-5 text-center ${
            isModal
              ? "text-[11px] text-zinc-600"
              : "text-xs text-gray-400"
          }`}
        >
          Contact:{" "}
          <a
            href="mailto:kovemusin@gmail.com"
            className={
              isModal
                ? "transition hover:text-zinc-400"
                : "font-medium transition hover:text-fuchsia-600"
            }
          >
            kovemusin@gmail.com
          </a>
        </div>
      </>
      )}
    </div>
  );
}
