"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import YouTubePreviewModal, {
  YouTubePreviewThumbnail,
} from "@/components/admin/YouTubePreviewModal";

type Candidate = {
  id: number;
  category: "kpop" | "cheer";
  source: "youtube";
  source_id: string;
  source_url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  view_count: number | null;
  like_count: number | null;
  channel_title: string | null;
  subject_name: string | null;
  heuristic_score: number | null;
  ai_score: number | null;
  ai_reason: string | null;
  ai_content_type: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  target_artist:
    | {
        id: string;
        name: string;
        username: string | null;
        category: string;
      }
    | {
        id: string;
        name: string;
        username: string | null;
        category: string;
      }[]
    | null;
};

type Counts = {
  pending: number;
  approved: number;
  rejected: number;
  pendingKpop: number;
  pendingCheer: number;
};

type CollectorStats = {
  runId?: string;
  searchedSubjectCount?: number;
  rawSearchVideoCount?: number;
  newMatchedVideoCount?: number;
  aiAnalyzedCandidateCount?: number;
  eligibleAfterAiCount?: number;
  queuedCount?: number;
  queuedByCategory?: {
    kpop?: number;
    cheer?: number;
  };
  aiFallbackCount?: number;
};

type ImportRun = {
  id: string;
  trigger_type: "manual" | "cron";
  status: "running" | "success" | "failed";
  started_at: string;
  finished_at: string | null;
  stats: CollectorStats | null;
  error_message: string | null;
};

type PreviewVideo = {
  videoId: string;
  title: string;
} | null;

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function formatCompactNumber(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function getTargetArtist(candidate: Candidate) {
  if (Array.isArray(candidate.target_artist)) {
    return candidate.target_artist[0] ?? null;
  }
  return candidate.target_artist;
}

function buildCollectorMessage(stats: CollectorStats) {
  const kpop = stats.queuedByCategory?.kpop ?? 0;
  const cheer = stats.queuedByCategory?.cheer ?? 0;
  return `수집 완료 · ${stats.searchedSubjectCount ?? 0} subjects 검색 · 신규 매칭 ${stats.newMatchedVideoCount ?? 0} · AI 평가 ${stats.aiAnalyzedCandidateCount ?? 0} · Pending ${stats.queuedCount ?? 0} (KPOP ${kpop} / CHEER ${cheer})`;
}

export default function AdminAiImportPage() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [category, setCategory] = useState<"all" | "kpop" | "cheer">("all");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [counts, setCounts] = useState<Counts>({
    pending: 0,
    approved: 0,
    rejected: 0,
    pendingKpop: 0,
    pendingCheer: 0,
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [latestRun, setLatestRun] = useState<ImportRun | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewVideo, setPreviewVideo] = useState<PreviewVideo>(null);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, category });
      const response = await fetch(`/api/admin/ai-import?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load AI import candidates.");
      }
      setCandidates(data.candidates ?? []);
      setCounts(data.counts ?? {});
      setSelectedIds(new Set());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load candidates.");
    } finally {
      setLoading(false);
    }
  }, [category, status]);

  const loadLatestRun = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ai-import/collect", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setLatestRun(data.runs?.[0] ?? null);
      }
    } catch {
      // Candidate review remains usable even if run history cannot be loaded.
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    void loadLatestRun();
  }, [loadLatestRun]);

  const allSelected = useMemo(
    () => candidates.length > 0 && candidates.every((candidate) => selectedIds.has(candidate.id)),
    [candidates, selectedIds],
  );

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(candidates.map((candidate) => candidate.id)));
  }

  function toggleCandidate(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runCollector() {
    if (collecting) return;
    setCollecting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/ai-import/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxQueue: 200 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "AI Import collection failed.");
      }

      const stats = (data.stats ?? {}) as CollectorStats;
      setMessage(buildCollectorMessage(stats));
      setStatus("pending");
      setCategory("all");
      await Promise.all([loadCandidates(), loadLatestRun()]);
    } catch (collectError) {
      setError(
        collectError instanceof Error
          ? collectError.message
          : "AI Import collection failed.",
      );
      await loadLatestRun();
    } finally {
      setCollecting(false);
    }
  }

  async function reviewSelected(action: "approve" | "reject") {
    if (selectedIds.size === 0 || reviewing) return;
    setReviewing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: Array.from(selectedIds) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Review failed.");
      }

      setMessage(
        action === "approve"
          ? `${data.reviewedCount ?? 0}개 승인 · 신규 ${data.importedCount ?? 0}개 Discover 등록`
          : `${data.reviewedCount ?? 0}개 제외`,
      );
      await loadCandidates();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Review failed.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <section className="mb-8">
          <p className="text-sm font-medium text-zinc-500">Kovemu Admin</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">AI Import Review</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                기존 KPOP · CHEER Works의 패턴을 기준으로 최근 YouTube 직캠을 수집·점수화합니다. 승인된 영상만 Discover에 노출됩니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runCollector()}
                disabled={collecting}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
              >
                {collecting ? "AI 수집 중..." : "Run AI Import"}
              </button>
              <Link
                href="/admin/artists"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
              >
                Artists
              </Link>
              <Link
                href="/admin/import"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                YouTube Importer
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-violet-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              1회 실행: KPOP 12 + CHEER 12 subject를 자동 선정해 최근 21일 영상을 검사하고 최대 200개만 Pending에 넣습니다.
            </span>
            {latestRun && (
              <span className="text-xs text-violet-700">
                Last: {latestRun.status.toUpperCase()} · {new Date(latestRun.started_at).toLocaleString()}
                {latestRun.status === "success" ? ` · ${latestRun.stats?.queuedCount ?? 0} queued` : ""}
              </span>
            )}
          </div>
        </section>

        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {([
              ["pending", `Pending ${counts.pending}`],
              ["approved", `Approved ${counts.approved}`],
              ["rejected", `Rejected ${counts.rejected}`],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  status === value
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {([
              ["all", "All"],
              ["kpop", `KPOP ${counts.pendingKpop}`],
              ["cheer", `CHEER ${counts.pendingCheer}`],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  category === value
                    ? "border-zinc-900 bg-zinc-100 text-zinc-950"
                    : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {status === "pending" && (
          <section className="sticky top-3 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleAll}
                disabled={candidates.length === 0}
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-40"
              >
                {allSelected ? "전체 해제" : "전체 선택"}
              </button>
              <span className="text-sm text-zinc-500">{selectedIds.size} selected</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void reviewSelected("reject")}
                disabled={selectedIds.size === 0 || reviewing}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-40"
              >
                제외
              </button>
              <button
                type="button"
                onClick={() => void reviewSelected("approve")}
                disabled={selectedIds.size === 0 || reviewing}
                className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {reviewing ? "처리 중..." : "선택 승인"}
              </button>
            </div>
          </section>
        )}

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {message && <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

        {loading ? (
          <section className="rounded-2xl border border-zinc-200 bg-white py-24 text-center text-sm text-zinc-500">
            Loading candidates...
          </section>
        ) : candidates.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-zinc-300 bg-white py-24 text-center">
            <h2 className="text-lg font-semibold text-zinc-900">No candidates</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Pending이 비어 있습니다. 위의 Run AI Import를 누르면 새로운 후보를 수집합니다.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {candidates.map((candidate) => {
              const selected = selectedIds.has(candidate.id);
              const targetArtist = getTargetArtist(candidate);

              return (
                <article
                  key={candidate.id}
                  onClick={() => status === "pending" && toggleCandidate(candidate.id)}
                  className={`overflow-hidden rounded-2xl border bg-white transition ${
                    selected ? "border-zinc-950 ring-2 ring-zinc-950/10" : "border-zinc-200"
                  } ${status === "pending" ? "cursor-pointer hover:border-zinc-400" : ""}`}
                >
                  <div className="relative aspect-video bg-zinc-100">
                    {candidate.thumbnail_url ? (
                      <YouTubePreviewThumbnail
                        url={candidate.source_url}
                        title={candidate.title}
                        thumbnail={candidate.thumbnail_url}
                        onPreview={(videoId, title) => setPreviewVideo({ videoId, title })}
                        className="h-full w-full"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-400">No thumbnail</div>
                    )}

                    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          candidate.category === "kpop"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {candidate.category.toUpperCase()}
                      </span>
                      {typeof candidate.ai_score === "number" && (
                        <span className="rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-white">
                          AI {candidate.ai_score}
                        </span>
                      )}
                    </div>

                    {status === "pending" && (
                      <div className={`pointer-events-none absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 ${selected ? "border-zinc-950 bg-zinc-950 text-white" : "border-white bg-black/30 text-transparent"}`}>
                        ✓
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h2 className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-950">{candidate.title}</h2>
                    <p className="mt-2 truncate text-xs text-zinc-500">
                      {candidate.channel_title || "YouTube"}
                      {candidate.subject_name ? ` · ${candidate.subject_name}` : ""}
                      {targetArtist ? ` · → ${targetArtist.name}` : " · → category admin"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                      <span>{formatDuration(candidate.duration_seconds)}</span>
                      <span>{formatCompactNumber(candidate.view_count)} views</span>
                      <span>{formatCompactNumber(candidate.like_count)} likes</span>
                      {typeof candidate.heuristic_score === "number" && (
                        <span>H {candidate.heuristic_score}</span>
                      )}
                      {candidate.published_at && (
                        <span>{new Date(candidate.published_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    {candidate.ai_reason && (
                      <p className="mt-3 line-clamp-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
                        {candidate.ai_reason}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {previewVideo && (
        <YouTubePreviewModal
          videoId={previewVideo.videoId}
          title={previewVideo.title}
          onClose={() => setPreviewVideo(null)}
        />
      )}
    </main>
  );
}
