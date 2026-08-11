"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  onSuccess?: () => void;
};

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        "Account created. Check your email to confirm your account.",
      );
    }

    setLoading(false);
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();

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

    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-black text-gray-950">
        Log in to Kovemu
      </h1>

      <p className="mt-2 text-sm text-gray-500">
        Discover your creators and share your work.
      </p>

      <form
        onSubmit={signIn}
        className="mt-8 space-y-5"
      >
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-800">
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none transition focus:border-fuchsia-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-800">
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            minLength={6}
            className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none transition focus:border-fuchsia-400"
          />
        </div>

        {message && (
          <p className="text-sm text-gray-600">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-full bg-fuchsia-600 font-bold text-white transition hover:bg-fuchsia-700 disabled:opacity-50"
        >
          {loading ? "Please wait..." : "Log in"}
        </button>

        <button
          type="button"
          onClick={signUp}
          disabled={loading}
          className="h-12 w-full rounded-full border border-gray-200 font-bold text-gray-800 transition hover:border-fuchsia-300 disabled:opacity-50"
        >
          Create account
        </button>
      </form>
    </div>
  );
}