import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDiscoverSubjectCompactQuery,
  discoverSubjectCompactVariants,
  mergeDiscoverSearchWorkIds,
  sliceDiscoverSearchPriorityPage,
} from "@/lib/discover/discoverSubjectSearch";

test("buildDiscoverSubjectCompactQuery normalizes spaced Latin aliases", () => {
  assert.equal(
    buildDiscoverSubjectCompactQuery("Lee Da Hye"),
    "leeda hye",
  );
  assert.deepEqual(
    discoverSubjectCompactVariants("Lee Da Hye"),
    ["leeda hye", "leedahye"],
  );
});

test("buildDiscoverSubjectCompactQuery preserves CJK aliases", () => {
  assert.equal(
    buildDiscoverSubjectCompactQuery("李多惠"),
    "李多惠",
  );
  assert.equal(
    buildDiscoverSubjectCompactQuery("이다혜"),
    "이다혜",
  );
});

test("mergeDiscoverSearchWorkIds keeps exact before partial and dedupes", () => {
  assert.deepEqual(
    mergeDiscoverSearchWorkIds({
      exactWorkIds: [3, 1],
      partialWorkIds: [2, 1, 4],
    }),
    [3, 1, 2, 4],
  );
});

test("sliceDiscoverSearchPriorityPage fills metadata after priority works", () => {
  assert.deepEqual(
    sliceDiscoverSearchPriorityPage([10, 20, 30], 0, 2),
    {
      prioritySlice: [10, 20],
      metadataFrom: 0,
      metadataLimit: 0,
    },
  );

  assert.deepEqual(
    sliceDiscoverSearchPriorityPage([10, 20, 30], 2, 2),
    {
      prioritySlice: [30],
      metadataFrom: 0,
      metadataLimit: 1,
    },
  );

  assert.deepEqual(
    sliceDiscoverSearchPriorityPage([10, 20, 30], 4, 2),
    {
      prioritySlice: [],
      metadataFrom: 1,
      metadataLimit: 2,
    },
  );
});
