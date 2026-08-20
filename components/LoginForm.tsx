"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  onSuccess?: () => void;
  mode?: "login" | "signup";
  presentation?: "page" | "modal" | "legacy";
  accountCreated?: boolean;
  onModeChange?: (
    mode: "login" | "signup",
  ) => void;
};

const SIGNUP_SUCCESS_MESSAGE =
  "Account created successfully. Log in to continue.";

const inputClassName =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-950 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#ffffff] [&:-webkit-autofill]:[-webkit-text-fill-color:#111827] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0_1000px_#ffffff] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0_1000px_#ffffff]";

function isAlreadyRegisteredError(error: {
  message?: string;
  code?: string;
}) {
  const message = (
    error.message ?? ""
  ).toLowerCase();
  const code = (
    error.code ?? ""
  ).toLowerCase();

  return (
    code === "user_already_exists" ||
    message.includes(
      "user already registered",
    ) ||
    message.includes(
      "already registered",
    )
  );
}

function mapSignupError(error: {
  message?: string;
  code?: string;
}) {
  if (isAlreadyRegisteredError(error)) {
    return {
      type: "already_registered" as const,
    };
  }

  const message = (
    error.message ?? ""
  ).toLowerCase();

  if (
    message.includes(
      "password should be at least",
    ) ||
    message.includes(
      "password must be at least",
    ) ||
    (message.includes("password") &&
      message.includes("6"))
  ) {
    return {
      type: "message" as const,
      message:
        "Password must be at least 6 characters.",
    };
  }

  if (
    message.includes(
      "valid email",
    ) ||
    message.includes(
      "invalid email",
    ) ||
    message.includes(
      "unable to validate email",
    )
  ) {
    return {
      type: "message" as const,
      message:
        "Enter a valid email address.",
    };
  }

  return {
    type: "message" as const,
    message:
      error.message ??
      "Something went wrong.",
  };
}

export default function LoginForm({
  onSuccess,
  mode = "login",
  presentation,
  accountCreated = false,
  onModeChange,
}: LoginFormProps) {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");
  const [message, setMessage] = useState("");
  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");
  const [
    alreadyRegistered,
    setAlreadyRegistered,
  ] = useState(false);
  const [loading, setLoading] = useState(false);

  const resolvedPresentation =
    presentation ??
    (onSuccess ? "legacy" : "page");
  const isSignup = mode === "signup";
  const showHeading =
    resolvedPresentation === "page" ||
    resolvedPresentation === "modal";
  const showFooter =
    resolvedPresentation === "page" ||
    resolvedPresentation === "modal";

  useEffect(() => {
    if (!isSignup && accountCreated) {
      setSuccessMessage(
        SIGNUP_SUCCESS_MESSAGE,
      );
    }
  }, [isSignup, accountCreated]);

  function switchToLoginAfterSignup() {
    setSuccessMessage(
      SIGNUP_SUCCESS_MESSAGE,
    );
    setMessage("");
    setAlreadyRegistered(false);
    setConfirmPassword("");
    setPassword("");

    if (
      resolvedPresentation === "modal"
    ) {
      onModeChange?.("login");
      return;
    }

    if (
      resolvedPresentation === "page"
    ) {
      router.push("/login?created=1");
    }
  }

  const signUp = async () => {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");
    setAlreadyRegistered(false);

    if (password !== confirmPassword) {
      setMessage(
        "Passwords do not match.",
      );
      setLoading(false);
      return;
    }

    const { data, error } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (error) {
      const mapped =
        mapSignupError(error);

      if (
        mapped.type ===
        "already_registered"
      ) {
        setAlreadyRegistered(true);
      } else {
        setMessage(mapped.message);
      }

      setLoading(false);
      return;
    }

    setLoading(false);

    if (data.session) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
      return;
    }

    if (data.user) {
      switchToLoginAfterSignup();
    }
  };

  const signIn = async () => {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccessMessage("");

    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

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

  return (
    <div>
      {showHeading && (
        <>
          <h1
            id={
              resolvedPresentation ===
              "modal"
                ? "auth-modal-title"
                : undefined
            }
            className="text-center text-2xl font-black tracking-tight text-gray-950"
          >
            {isSignup
              ? "Join Kovemu"
              : "Welcome to Kovemu"}
          </h1>

          <p className="mt-2 text-center text-sm leading-6 text-gray-500">
            {isSignup
              ? "Discover and save artists you love."
              : "Discover Korean artists you'll love."}
          </p>
        </>
      )}

      <form
        onSubmit={handleSubmit}
        className={
          showHeading
            ? "mt-8 space-y-5"
            : "space-y-4"
        }
      >
        {!isSignup &&
          successMessage && (
            <p className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 text-sm leading-5 text-fuchsia-700">
              {successMessage}
            </p>
          )}

        <div>
          <label
            htmlFor={emailId}
            className="mb-2 block text-sm font-semibold text-gray-800"
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

        <div>
          <label
            htmlFor={passwordId}
            className="mb-2 block text-sm font-semibold text-gray-800"
          >
            Password
          </label>

          <input
            id={passwordId}
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value,
              )
            }
            placeholder="Password"
            required
            minLength={6}
            autoComplete={
              isSignup
                ? "new-password"
                : "current-password"
            }
            className={inputClassName}
          />
        </div>

        {isSignup && (
          <div>
            <label
              htmlFor={confirmPasswordId}
              className="mb-2 block text-sm font-semibold text-gray-800"
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
              minLength={6}
              autoComplete="new-password"
              className={inputClassName}
            />
          </div>
        )}

        {alreadyRegistered ? (
          <p className="text-sm leading-5 text-red-500">
            This email is already
            registered.{" "}
            {resolvedPresentation ===
            "modal" ? (
              <button
                type="button"
                onClick={() => {
                  setAlreadyRegistered(
                    false,
                  );
                  setMessage("");
                  onModeChange?.(
                    "login",
                  );
                }}
                className="font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
              >
                Log in
              </button>
            ) : (
              <Link
                href="/login"
                className="font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
              >
                Log in
              </Link>
            )}{" "}
            instead.
          </p>
        ) : (
          message && (
            <p className="text-sm leading-5 text-red-500">
              {message}
            </p>
          )
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-full bg-fuchsia-600 text-sm font-bold text-white transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Please wait..."
            : isSignup
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      {showFooter && (
        <div className="mt-6 text-center text-sm text-gray-500">
          {resolvedPresentation ===
          "modal" ? (
            isSignup ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setAlreadyRegistered(
                      false,
                    );
                    setSuccessMessage(
                      "",
                    );
                    onModeChange?.(
                      "login",
                    );
                  }}
                  className="font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                New to Kovemu?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setSuccessMessage(
                      "",
                    );
                    onModeChange?.(
                      "signup",
                    );
                  }}
                  className="font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
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
                className="font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
              >
                Log in
              </Link>
            </>
          ) : (
            <>
              New to Kovemu?{" "}
              <Link
                href="/join"
                className="font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
              >
                Join
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
