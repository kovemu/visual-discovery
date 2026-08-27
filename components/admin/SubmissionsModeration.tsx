"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SubmissionRow = {
  id: string;
  user_id: string | null;
  source_url: string;
  source_type: "youtube" | "tiktok";
  status: string;
  created_at: string;
};

function formatSourceLabel(
  sourceType: string,
) {
  if (sourceType === "youtube") {
    return "YouTube";
  }

  if (sourceType === "tiktok") {
    return "TikTok";
  }

  return sourceType;
}

function formatSubmittedAt(
  value: string,
) {
  return new Date(value).toLocaleString();
}

export default function SubmissionsModeration() {
  const [
    submissions,
    setSubmissions,
  ] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");
  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const loadSubmissions =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/admin/submissions",
          );

        if (!response.ok) {
          throw new Error(
            await response.text(),
          );
        }

        const data =
          (await response.json()) as {
            submissions?: SubmissionRow[];
          };

        setSubmissions(
          data.submissions ?? [],
        );
      } catch (loadError) {
        console.error(
          "LOAD SUBMISSIONS ERROR:",
          loadError,
        );
        setError(
          "Failed to load pending submissions.",
        );
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
    setUpdatingId(id);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/submissions/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              status,
            }),
          },
        );

      if (!response.ok) {
        throw new Error(
          await response.text(),
        );
      }

      setSubmissions((current) =>
        current.filter(
          (item) =>
            item.id !== id,
        ),
      );
    } catch (updateError) {
      console.error(
        "UPDATE SUBMISSION ERROR:",
        updateError,
      );
      setError(
        "Failed to update submission.",
      );
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
            Pending user submissions
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
        <p className="mt-4 text-sm text-red-600">
          {error}
        </p>
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
        <div className="mt-8 overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Source
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  URL
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Submitted
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {submissions.map(
                (submission) => (
                  <tr
                    key={
                      submission.id
                    }
                  >
                    <td className="px-4 py-3 font-medium text-gray-950">
                      {formatSourceLabel(
                        submission.source_type,
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-600">
                      {
                        submission.source_url
                      }
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {formatSubmittedAt(
                        submission.created_at,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={
                            submission.source_url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-gray-400"
                        >
                          Open Original
                        </a>
                        <button
                          type="button"
                          disabled={
                            updatingId ===
                            submission.id
                          }
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
                          disabled={
                            updatingId ===
                            submission.id
                          }
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
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
