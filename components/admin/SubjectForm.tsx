"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CREATOR_CATEGORY_OPTIONS,
} from "@/lib/creator/creatorCategories";
import { normalizeSubjectAlias } from "@/lib/subjects/normalizeSubjectText";
import type { AliasConflict } from "@/lib/subjects/subjectTypes";
import {
  SUBJECT_GROUP_RELATION_TYPES,
  SUBJECT_LANGUAGES,
  SUBJECT_MATCH_MODES,
  SUBJECT_TYPES,
  type SubjectCategory,
  type SubjectGroupRelationType,
  type SubjectLanguage,
  type SubjectMatchMode,
  type SubjectType,
} from "@/lib/subjects/subjectTypes";

export type SubjectFormAlias = {
  alias: string;
  language: string;
  match_mode: SubjectMatchMode;
  auto_match_enabled: boolean;
};

export type SubjectFormMembership = {
  group_subject_id: string;
  relation_type: SubjectGroupRelationType;
};

export type SubjectFormGroupOption = {
  id: string;
  name: string;
};

export type SubjectFormValue = {
  type: SubjectType;
  category: SubjectCategory;
  slug: string;
  name_ko: string;
  name_en: string;
  name_zh_tw: string;
  active: boolean;
  aliases: SubjectFormAlias[];
  memberships: SubjectFormMembership[];
};

const emptyAlias = (): SubjectFormAlias => ({
  alias: "",
  language: "ko",
  match_mode: "substring",
  auto_match_enabled: true,
});

function defaultValue(
  initial?: Partial<SubjectFormValue>,
): SubjectFormValue {
  return {
    type: initial?.type ?? "person",
    category: initial?.category ?? "cheer",
    slug: initial?.slug ?? "",
    name_ko: initial?.name_ko ?? "",
    name_en: initial?.name_en ?? "",
    name_zh_tw: initial?.name_zh_tw ?? "",
    active: initial?.active ?? true,
    aliases:
      initial?.aliases && initial.aliases.length > 0
        ? initial.aliases
        : [emptyAlias()],
    memberships: initial?.memberships ?? [],
  };
}

export default function SubjectForm({
  mode,
  subjectId,
  initial,
  availableGroups = [],
}: {
  mode: "create" | "edit";
  subjectId?: string;
  initial?: Partial<SubjectFormValue>;
  availableGroups?: SubjectFormGroupOption[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(() => defaultValue(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<AliasConflict[]>([]);
  const [message, setMessage] = useState("");
  const [reclassifying, setReclassifying] = useState(false);

  const nameCandidates = useMemo(
    () =>
      [value.name_ko, value.name_en, value.name_zh_tw]
        .map((name) => name.trim())
        .filter(Boolean),
    [value.name_ko, value.name_en, value.name_zh_tw],
  );

  function update<K extends keyof SubjectFormValue>(
    key: K,
    next: SubjectFormValue[K],
  ) {
    setValue((current) => ({
      ...current,
      [key]: next,
    }));
  }

  function addNameAliases() {
    setValue((current) => {
      const existing = new Set(
        current.aliases
          .map((alias) => normalizeSubjectAlias(alias.alias))
          .filter(Boolean),
      );

      const nextAliases = [...current.aliases];

      for (const name of nameCandidates) {
        const normalized = normalizeSubjectAlias(name);

        if (!normalized || existing.has(normalized)) {
          continue;
        }

        existing.add(normalized);
        nextAliases.push({
          alias: name,
          language:
            name === current.name_ko
              ? "ko"
              : name === current.name_zh_tw
                ? "zh-TW"
                : "en",
          match_mode: /[A-Za-z]/.test(name) ? "token" : "substring",
          auto_match_enabled: true,
        });
      }

      return {
        ...current,
        aliases: nextAliases.filter(
          (alias, index) => alias.alias.trim() || index === 0,
        ),
      };
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    setConflicts([]);

    try {
      const payload = {
        type: value.type,
        category: value.category,
        slug: value.slug,
        name_ko: value.name_ko,
        name_en: value.name_en,
        name_zh_tw: value.name_zh_tw,
        active: value.active,
        aliases: value.aliases.filter((alias) => alias.alias.trim()),
        memberships:
          value.type === "person" && value.category === "kpop"
            ? value.memberships
            : undefined,
      };

      const response = await fetch(
        mode === "create"
          ? "/api/admin/subjects"
          : `/api/admin/subjects/${subjectId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Save failed.");
      }

      if (Array.isArray(data.aliasConflicts)) {
        setConflicts(data.aliasConflicts);
      }

      setMessage(
        data.aliasConflicts?.length
          ? "Saved. Some aliases already exist on other subjects in this category."
          : "Saved.",
      );

      if (mode === "create" && data.subjectId) {
        router.push(`/admin/subjects/${data.subjectId}`);
        router.refresh();
        return;
      }

      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Save failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reclassify() {
    setReclassifying(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/subjects/reclassify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: value.category,
          subjectId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Reclassify failed.");
      }

      setMessage(
        `Reclassified ${data.processed} ${data.category} works. ${data.matchCount} auto links.`,
      );
      router.refresh();
    } catch (reclassifyError) {
      setError(
        reclassifyError instanceof Error
          ? reclassifyError.message
          : "Reclassify failed.",
      );
    } finally {
      setReclassifying(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Type</span>
          <select
            value={value.type}
            onChange={(event) =>
              update("type", event.target.value as SubjectType)
            }
            className="h-11 w-full rounded-xl border border-zinc-200 px-3"
          >
            {SUBJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Category</span>
          <select
            value={value.category}
            onChange={(event) =>
              update("category", event.target.value as SubjectCategory)
            }
            className="h-11 w-full rounded-xl border border-zinc-200 px-3"
          >
            {CREATOR_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-500">Slug</span>
        <input
          value={value.slug}
          onChange={(event) => update("slug", event.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 px-3"
          placeholder="kim-haeri"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">name_ko</span>
          <input
            value={value.name_ko}
            onChange={(event) => update("name_ko", event.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">name_en</span>
          <input
            value={value.name_en}
            onChange={(event) => update("name_en", event.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">name_zh_tw</span>
          <input
            value={value.name_zh_tw}
            onChange={(event) => update("name_zh_tw", event.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 px-3"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.active}
          onChange={(event) => update("active", event.target.checked)}
        />
        Active
      </label>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Aliases</h2>
          <button
            type="button"
            onClick={addNameAliases}
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            Add names as aliases
          </button>
        </div>

        <div className="space-y-3">
          {value.aliases.map((alias, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-zinc-100 p-3 sm:grid-cols-[1fr_120px_120px_auto_auto]"
            >
              <input
                value={alias.alias}
                onChange={(event) => {
                  const next = [...value.aliases];
                  next[index] = {
                    ...alias,
                    alias: event.target.value,
                  };
                  update("aliases", next);
                }}
                placeholder="alias"
                className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
              />
              <select
                value={alias.language}
                onChange={(event) => {
                  const next = [...value.aliases];
                  next[index] = {
                    ...alias,
                    language: event.target.value as SubjectLanguage | "",
                  };
                  update("aliases", next);
                }}
                className="h-10 rounded-lg border border-zinc-200 px-2 text-sm"
              >
                <option value="">lang</option>
                {SUBJECT_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
              <select
                value={alias.match_mode}
                onChange={(event) => {
                  const next = [...value.aliases];
                  next[index] = {
                    ...alias,
                    match_mode: event.target.value as SubjectMatchMode,
                  };
                  update("aliases", next);
                }}
                className="h-10 rounded-lg border border-zinc-200 px-2 text-sm"
              >
                {SUBJECT_MATCH_MODES.map((modeOption) => (
                  <option key={modeOption} value={modeOption}>
                    {modeOption}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={alias.auto_match_enabled}
                  onChange={(event) => {
                    const next = [...value.aliases];
                    next[index] = {
                      ...alias,
                      auto_match_enabled: event.target.checked,
                    };
                    update("aliases", next);
                  }}
                />
                auto
              </label>
              <button
                type="button"
                onClick={() =>
                  update(
                    "aliases",
                    value.aliases.filter((_, aliasIndex) => aliasIndex !== index),
                  )
                }
                className="text-sm text-zinc-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => update("aliases", [...value.aliases, emptyAlias()])}
          className="mt-3 text-sm text-zinc-500 hover:text-zinc-800"
        >
          + Add alias
        </button>
      </section>

      {value.type === "person" &&
      value.category === "kpop" &&
      availableGroups.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold">Groups</h2>
          <div className="space-y-2">
            {availableGroups.map((group) => {
              const membership = value.memberships.find(
                (item) => item.group_subject_id === group.id,
              );

              return (
                <label
                  key={group.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(membership)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          update("memberships", [
                            ...value.memberships,
                            {
                              group_subject_id: group.id,
                              relation_type: "current",
                            },
                          ]);
                          return;
                        }

                        update(
                          "memberships",
                          value.memberships.filter(
                            (item) => item.group_subject_id !== group.id,
                          ),
                        );
                      }}
                    />
                    {group.name}
                  </span>
                  {membership ? (
                    <select
                      value={membership.relation_type}
                      onChange={(event) => {
                        const relationType = event.target
                          .value as SubjectGroupRelationType;
                        update(
                          "memberships",
                          value.memberships.map((item) =>
                            item.group_subject_id === group.id
                              ? {
                                  ...item,
                                  relation_type: relationType,
                                }
                              : item,
                          ),
                        );
                      }}
                      className="h-9 rounded-lg border border-zinc-200 px-2 text-sm"
                    >
                      {SUBJECT_GROUP_RELATION_TYPES.map((relationType) => (
                        <option key={relationType} value={relationType}>
                          {relationType}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      {conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            Alias already used by another subject in this category:
          </p>
          <ul className="mt-2 list-disc pl-5">
            {conflicts.map((conflict) => (
              <li key={`${conflict.subject_id}:${conflict.normalized_alias}`}>
                {conflict.alias} → {conflict.name_ko || conflict.slug}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-zinc-500">{message}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        {mode === "edit" && (
          <button
            type="button"
            onClick={() => void reclassify()}
            disabled={reclassifying}
            className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium disabled:opacity-50"
          >
            {reclassifying ? "Reclassifying..." : "Reclassify"}
          </button>
        )}
      </div>
    </form>
  );
}
