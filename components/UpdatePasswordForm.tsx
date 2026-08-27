"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  mapPasswordUpdateError,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/authErrors";
import { isRealAccountUser } from "@/lib/auth/userKind";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "h-11 w-full rounded-lg border border-zinc-800 bg-[#181818] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30";

export default function UpdatePasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const inFlightRef = useRef(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (loading || inFlightRef.current) {
      return;
    }

    if (!password) {
      setMessage("Enter a password.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();

      if (!sessionUser) {
        setMessage("This link is invalid or has expired.");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setMessage(mapPasswordUpdateError(error));
        return;
      }

      const {
        data: { user },
        error: refreshError,
      } = await supabase.auth.getUser();

      if (refreshError || !isRealAccountUser(user)) {
        setMessage(
          "Could not finish setting up your account. Try again.",
        );
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="new-password"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          New password
        </label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClassName}
        />
      </div>

      <div>
        <label
          htmlFor="confirm-new-password"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Confirm password
        </label>
        <input
          id="confirm-new-password"
          type="password"
          value={confirmPassword}
          onChange={(event) =>
            setConfirmPassword(event.target.value)
          }
          placeholder="Confirm password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClassName}
        />
      </div>

      {message ? (
        <p className="text-sm leading-5 text-red-400">{message}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Please wait..." : "Update password"}
      </button>
    </form>
  );
}
