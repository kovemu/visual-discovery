"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReclassifyCategoryButton({
  category,
}: {
  category: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (category === "all") {
    return null;
  }

  async function run() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/subjects/reclassify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Reclassify failed.");
      }

      setMessage(
        `Reclassified ${data.processed} works · ${data.matchCount} auto links`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Reclassify failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Reclassifying..." : `Reclassify ${category.toUpperCase()}`}
      </button>
      {message ? (
        <span className="text-xs text-zinc-500">{message}</span>
      ) : null}
    </div>
  );
}
