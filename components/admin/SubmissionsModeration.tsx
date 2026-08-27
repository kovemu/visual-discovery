"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  CREATOR_CATEGORY_OPTIONS,
  type CreatorCategory,
} from "@/lib/creator/creatorCategories";

type SubmissionRow = {
  id: string;
  user_id: string | null;
  source_url: string;
  source_type: "youtube" | "tiktok";
  source_id?: string | null;
  title?: string | null;
  thumbnail_url?: string | null;
  submitter?: string | null;
  status: string;
  created_at: string;
};

function formatSourceLabel(sourceType: string) {
  if (sourceType === "youtube") {
    return "YouTube";
  }

  if (sourceType === "tiktok") {
    return "TikTok";
  }

  return sourceType;
}

function formatSubmittedAt(value: string) {
  return new Date(value).toLocaleString();
}

export default function SubmissionsModeration() {
  const [submissions, setSubmissions] = useState<
    SubmissionRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<
    string | null
  >(null);
  const [selectedCategories, setSelectedCategories] =
    useState<Record<string, CreatorCategory>>({});
  const [rowErrors, setRowErrors] = useState<
    Record<string, string>
  >({});

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/submissions",
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as {
        submissions?: SubmissionRow[];
      };

      setSubmissions(data.submissions ?? []);
    } catch (loadError) {
      console.error("LOAD SUBMISSIONS ERROR:", loadError);
      setError("Failed to load pending submissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  async function updateStatus(
    id: string,
    status: "approved" | "rejected",
  ) {
    const discoverCategory = selectedCategories[id];

    if (status === "approved" && !discoverCategory) {
      setRowErrors((current) => ({
        ...current,
        [id]: "Select a category before approving.",
      }));
      return;
    }

    setUpdatingId(id);
    setError("");
    setRowErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

    try {
      const response = await fetch(
        `/api/admin/submissions/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            ...(status === "approved"
              ? {
                  discover_category: discoverCategory,
                }
              : {}),
          }),
        },
      );

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setRowErrors((current) => ({
          ...current,
          [id]:
            data.error ||
            "Failed to update submission.",
        }));
        return;
      }

      setSubmissions((current) =>
        current.filter((item) => item.id !== id),
      );
    } catch (updateError) {
      console.error("UPDATE SUBMISSION ERROR:", updateError);
      setRowErrors((current) => ({
        ...current,
        [id]: "Failed to update submission.",
      }));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">
            Clip Submissions
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review user-imported clips before they appear
            in Discover.
          </p>
        </div>

        <Link
          href="/admin/artists"
          className="text-sm font-semibold text-gray-600 transition hover:text-gray-950"
        >
          Back to Admin
        </Link>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-gray-500">
          Loading...
        </p>
      ) : submissions.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">
          No pending submissions.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {submissions.map((submission) => {
            const selected =
              selectedCategories[submission.id];
            const rowError = rowErrors[submission.id];
            const busy = updatingId === submission.id;

            return (
              <article
                key={submission.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row">
                  {submission.thumbnail_url ? (
                    <img
                      src={submission.thumbnail_url}
                      alt=""
                      className="aspect-video w-full shrink-0 rounded-xl object-cover md:h-28 md:w-48 md:aspect-auto"
                    />
                  ) : (
                    <div className="flex aspect-video w-full shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-semibold text-gray-400 md:h-28 md:w-48 md:aspect-auto">
                      {formatSourceLabel(
                        submission.source_type,
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-gray-950">
                      {submission.title ||
                        formatSourceLabel(
                          submission.source_type,
                        )}
                    </p>
                    <a
                      href={submission.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-sm text-gray-500 hover:text-gray-800"
                    >
                      {submission.source_url}
                    </a>
                    <p className="mt-2 text-sm text-gray-600">
                      {submission.submitter ||
                        submission.user_id ||
                        "Unknown submitter"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatSubmittedAt(
                        submission.created_at,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      Category
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CREATOR_CATEGORY_OPTIONS.map(
                        (option) => {
                          const isActive =
                            selected === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setSelectedCategories(
                                  (current) => ({
                                    ...current,
                                    [submission.id]:
                                      option.value,
                                  }),
                                );
                                setRowErrors(
                                  (current) => {
                                    const next = {
                                      ...current,
                                    };
                                    delete next[
                                      submission.id
                                    ];
                                    return next;
                                  },
                                );
                              }}
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                                isActive
                                  ? "border-gray-950 bg-gray-950 text-white"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={submission.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-gray-400"
                    >
                      Open Original
                    </a>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void updateStatus(
                          submission.id,
                          "approved",
                        )
                      }
                      className="rounded-full bg-gray-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void updateStatus(
                          submission.id,
                          "rejected",
                        )
                      }
                      className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-gray-400 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {rowError ? (
                  <p className="mt-3 text-sm text-red-600">
                    {rowError}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
