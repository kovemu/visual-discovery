"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/client";

const categories = [
  "music",
  "dance",
  "film",
  "art",
  "cosplay",
];

export default function CreateCreatorPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState("music");
  const [bio, setBio] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You need to log in first.");
      setLoading(false);
      return;
    }

    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    const { error } = await supabase
      .from("creators")
      .insert({
        user_id: user.id,
        username: cleanUsername,
        name: name.trim(),
        category,
        bio: bio.trim() || null,
      });

    if (error) {
      if (error.code === "23505") {
        setMessage(
          "That username is already being used.",
        );
      } else {
        setMessage(error.message);
      }

      setLoading(false);
      return;
    }

    router.push("/account");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-600">
          Creator
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-950">
          Create your profile
        </h1>

        <p className="mt-3 text-gray-500">
          Tell people who you are and what you create.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-7"
        >
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Creator name
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              required
              placeholder="Mina Studio"
              className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none transition focus:border-fuchsia-400"
            />

            <p className="mt-2 text-sm text-gray-400">
              This is the name people will see on Kovemu.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Username
            </label>

            <div className="flex h-12 overflow-hidden rounded-xl border border-gray-200 focus-within:border-fuchsia-400">
              <span className="flex items-center bg-gray-50 px-4 text-sm text-gray-400">
                kovemu.com/
              </span>

              <input
                type="text"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                required
                placeholder="minastudio"
                className="min-w-0 flex-1 px-4 outline-none"
              />
            </div>

            <p className="mt-2 text-sm text-gray-400">
              Choose a unique username for your creator profile.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Category
            </label>

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 outline-none transition focus:border-fuchsia-400"
            >
              {categories.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item.charAt(0).toUpperCase() +
                    item.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Bio
            </label>

            <textarea
              value={bio}
              onChange={(event) =>
                setBio(event.target.value)
              }
              placeholder="Tell people about your work..."
              maxLength={300}
              rows={5}
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-fuchsia-400"
            />

            <div className="mt-2 text-right text-sm text-gray-400">
              {bio.length}/300
            </div>
          </div>

          {message && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-full bg-fuchsia-600 px-8 font-bold text-white transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Creating..."
              : "Create Creator Profile"}
          </button>
        </form>
      </div>
    </main>
  );
}