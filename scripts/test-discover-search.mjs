import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const MAX_DISCOVER_SEARCH_TOKENS = 5;

if (!url || !key) {
  console.error(
    "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL and key).",
  );
  process.exit(1);
}

const supabase = createClient(url, key);

function normalizeDiscoverSearchQuery(query) {
  const collapsed = (query?.trim() ?? "").replace(/\s+/g, " ");
  if (collapsed.length === 0) {
    return null;
  }
  return collapsed.normalize("NFKC");
}

function tokenizeDiscoverSearchQuery(searchQuery) {
  if (!searchQuery) {
    return [];
  }

  return Array.from(
    new Set(
      searchQuery
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_DISCOVER_SEARCH_TOKENS);
}

function escapePattern(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/_/g, "\\_");
}

function buildPattern(token) {
  return `"*${escapePattern(token)}*"`;
}

function buildWorksOnlyOr(token, creatorIds) {
  const pattern = buildPattern(token);
  const filters = [
    `title.ilike.${pattern}`,
    `description.ilike.${pattern}`,
  ];

  if (creatorIds.length > 0) {
    filters.push(
      `artist_id.in.(${creatorIds.map((id) => `"${id}"`).join(",")})`,
    );
  }

  return filters.join(",");
}

async function resolveCreatorIdsForToken(token) {
  const pattern = buildPattern(token);
  const { data, error } = await supabase
    .from("creators")
    .select("id, name, username")
    .or(`name.ilike.${pattern},username.ilike.${pattern}`)
    .limit(500);

  return {
    token,
    creatorIds: (data ?? []).map((row) => row.id),
    error,
  };
}

async function resolveTokenMatches(tokens) {
  const matches = await Promise.all(
    tokens.map((token) => resolveCreatorIdsForToken(token)),
  );

  const errors = matches
    .map((match) => match.error)
    .filter(Boolean);

  return {
    tokenMatches: matches.map(({ token, creatorIds }) => ({
      token,
      creatorIds,
    })),
    errors,
  };
}

function applyMultiTokenSearch(query, tokenMatches) {
  let nextQuery = query;

  for (const match of tokenMatches) {
    nextQuery = nextQuery.or(
      buildWorksOnlyOr(match.token, match.creatorIds),
    );
  }

  return nextQuery;
}

async function testPhraseSearch(rawQuery) {
  const normalized = normalizeDiscoverSearchQuery(rawQuery);
  const tokens = tokenizeDiscoverSearchQuery(normalized);
  const { tokenMatches, errors } =
    await resolveTokenMatches(tokens);

  if (errors.length > 0) {
    return {
      query: rawQuery,
      normalized,
      tokens,
      tokenMatches: tokenMatches.map((match) => ({
        token: match.token,
        creatorMatches: match.creatorIds.length,
      })),
      count: 0,
      countError: errors[0]
        ? {
            stage: "creator lookup",
            code: errors[0].code,
            message: errors[0].message,
          }
        : null,
      fetchError: null,
      sample: [],
    };
  }

  let countQuery = supabase
    .from("works")
    .select("id", { count: "exact", head: true })
    .eq("featured", false)
    .eq("discover_eligible", true);

  countQuery = applyMultiTokenSearch(
    countQuery,
    tokenMatches,
  );

  const { count, error: countError } = await countQuery;

  let fetchQuery = supabase
    .from("works")
    .select("id, title, artist:creators(name, username)")
    .eq("featured", false)
    .eq("discover_eligible", true);

  fetchQuery = applyMultiTokenSearch(
    fetchQuery,
    tokenMatches,
  );

  const { data, error: fetchError } = await fetchQuery.limit(5);

  return {
    query: rawQuery,
    normalized,
    tokens,
    tokenMatches: tokenMatches.map((match) => ({
      token: match.token,
      creatorMatches: match.creatorIds.length,
    })),
    count: count ?? 0,
    countError: countError
      ? {
          code: countError.code,
          message: countError.message,
          details: countError.details,
          hint: countError.hint,
        }
      : null,
    fetchError: fetchError
      ? {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
        }
      : null,
    sample: (data ?? []).slice(0, 3).map((row) => ({
      title: row.title,
      artist: row.artist?.name ?? null,
    })),
  };
}

async function testAndSemantics() {
  const tokenMatches = [
    {
      token: "직캠",
      creatorIds: [],
    },
    {
      token: "치어리더",
      creatorIds: [],
    },
  ];

  const [singleA, singleB, combined] = await Promise.all([
    applyMultiTokenSearch(
      supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("featured", false)
        .eq("discover_eligible", true),
      [tokenMatches[0]],
    ),
    applyMultiTokenSearch(
      supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("featured", false)
        .eq("discover_eligible", true),
      [tokenMatches[1]],
    ),
    applyMultiTokenSearch(
      supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("featured", false)
        .eq("discover_eligible", true),
      tokenMatches,
    ),
  ]);

  const [countA, countB, countCombined] = await Promise.all([
    singleA,
    singleB,
    combined,
  ]);

  return {
    label: "AND semantics check",
    직캠Only: countA.count ?? 0,
    치어리더Only: countB.count ?? 0,
    combined: countCombined.count ?? 0,
    combinedIsSubset:
      (countCombined.count ?? 0) <=
      Math.min(countA.count ?? 0, countB.count ?? 0),
    errors: [countA.error, countB.error, countCombined.error].filter(
      Boolean,
    ),
  };
}

const searchTerms = [
  "직캠",
  "아이린 직캠",
  "치어리더 직캠",
  "여자 아이돌",
  "CheerS 직캠",
  "아이린    직캠",
  "   아이린 직캠   ",
  "kpop",
  "kpop fancam",
];

console.log("=== Discover multi-token search runtime verification ===\n");

console.log(
  JSON.stringify(await testAndSemantics(), null, 2),
);
console.log("");

for (const term of searchTerms) {
  const result = await testPhraseSearch(term);
  console.log(`--- ${term} ---`);
  console.log(JSON.stringify(result, null, 2));
  console.log("");
}
