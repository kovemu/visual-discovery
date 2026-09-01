import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  classifyWorksSubjects,
  loadClassifiableWorksByCategory,
  loadGroupMemberships,
  loadMatcherSubjects,
} from "@/lib/subjects/classifyWorks.server";
import { matchWorksToSubjects } from "@/lib/subjects/matchSubjectAliases";
import {
  SUBJECT_CATEGORIES,
  isSubjectCategory,
  type SubjectCategory,
} from "@/lib/subjects/subjectTypes";

const CHUNK_SIZE = 400;

loadEnvConfig(process.cwd());

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const categoryArg = argv.find((arg) => arg.startsWith("--category="));
  const requested = categoryArg?.slice("--category=".length) ?? "all";

  const categories: SubjectCategory[] =
    requested === "all"
      ? [...SUBJECT_CATEGORIES]
      : isSubjectCategory(requested)
        ? [requested]
        : [];

  return { dryRun, categories, requested };
}

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function runCategory(
  supabase: SupabaseClient,
  category: SubjectCategory,
  dryRun: boolean,
) {
  console.log(`\n[${category}]`);

  let offset = 0;
  let processed = 0;
  let matchedWorks = 0;
  let unmatchedWorks = 0;
  let matchCount = 0;
  const matchCountBySubjectId: Record<string, number> = {};
  const skipped = new Map<string, string[]>();
  const subjects = await loadMatcherSubjects(supabase, [category]);
  const memberships =
    category === "kpop" ? await loadGroupMemberships(supabase) : [];

  while (true) {
    const works = await loadClassifiableWorksByCategory(supabase, category, {
      from: offset,
      to: offset + CHUNK_SIZE - 1,
    });

    if (works.length === 0) {
      break;
    }

    try {
      if (dryRun) {
        const preview = matchWorksToSubjects(works, subjects, memberships);
        processed += works.length;
        matchedWorks += preview.matchedWorkIds.length;
        unmatchedWorks += preview.unmatchedWorkIds.length;
        matchCount += preview.matches.length;

        for (const [subjectId, count] of Object.entries(
          preview.matchCountBySubjectId,
        )) {
          matchCountBySubjectId[subjectId] =
            (matchCountBySubjectId[subjectId] ?? 0) + count;
        }

        for (const item of preview.skippedAmbiguousAliases) {
          skipped.set(item.normalizedAlias, item.subjectIds);
        }
      } else {
        const result = await classifyWorksSubjects(
          supabase,
          works.map((work) => work.id),
        );
        processed += works.length;
        matchedWorks += result.matchedWorkIds.length;
        unmatchedWorks += result.unmatchedWorkIds.length;
        matchCount += result.matchCount;

        for (const [subjectId, count] of Object.entries(
          result.matchCountBySubjectId,
        )) {
          matchCountBySubjectId[subjectId] =
            (matchCountBySubjectId[subjectId] ?? 0) + count;
        }

        for (const item of result.skippedAmbiguousAliases) {
          skipped.set(item.normalizedAlias, item.subjectIds);
        }
      }

      console.log(
        `  chunk ${offset}-${offset + works.length - 1}: ${works.length} works`,
      );
    } catch (error) {
      console.error(
        `  FAILED chunk ${offset}-${offset + CHUNK_SIZE - 1}`,
        error,
      );
    }

    offset += CHUNK_SIZE;

    if (works.length < CHUNK_SIZE) {
      break;
    }
  }

  const subjectLabel = new Map(
    subjects.map((subject) => [
      subject.id,
      subject.aliases[0]?.alias ?? subject.id,
    ]),
  );

  console.log(`  processed: ${processed}`);
  console.log(`  matched works: ${matchedWorks}`);
  console.log(`  unmatched works: ${unmatchedWorks}`);
  console.log(`  auto links: ${matchCount}`);

  const ranked = Object.entries(matchCountBySubjectId).sort(
    (left, right) => right[1] - left[1],
  );

  if (ranked.length > 0) {
    console.log("  subject match counts:");
    for (const [subjectId, count] of ranked.slice(0, 30)) {
      console.log(`    ${subjectLabel.get(subjectId) ?? subjectId}: ${count}`);
    }
  }

  if (skipped.size > 0) {
    console.log("  ambiguous aliases skipped:");
    for (const [alias, subjectIds] of skipped) {
      console.log(`    ${alias} (${subjectIds.length} subjects)`);
    }
  }

  return {
    processed,
    matchedWorks,
    unmatchedWorks,
    matchCount,
  };
}

async function main() {
  const { dryRun, categories, requested } = parseArgs(process.argv.slice(2));

  if (categories.length === 0) {
    throw new Error(
      `Invalid category "${requested}". Use cheer, kpop, look, or all.`,
    );
  }

  const supabase = createServiceClient();

  console.log(
    dryRun
      ? "Dry-run: no work_subjects writes."
      : "Writing auto work_subjects. Manual mappings are preserved.",
  );
  console.log(`Categories: ${categories.join(", ")}`);
  console.log(`Chunk size: ${CHUNK_SIZE}`);

  const totals = {
    processed: 0,
    matchedWorks: 0,
    unmatchedWorks: 0,
    matchCount: 0,
  };

  for (const category of categories) {
    const result = await runCategory(supabase, category, dryRun);
    totals.processed += result.processed;
    totals.matchedWorks += result.matchedWorks;
    totals.unmatchedWorks += result.unmatchedWorks;
    totals.matchCount += result.matchCount;
  }

  console.log("\nDone.");
  console.log(totals);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
