import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDiscoverSubjectId } from "@/lib/discover/discoverSubjectFilter";
import {
  buildSubjectLandingCopy,
  buildSubjectLandingPath,
  resolveSubjectDisplayName,
  shouldIndexSubjectLanding,
  subjectLandingHreflang,
} from "@/lib/seo/subjectLanding";

test("parseDiscoverSubjectId accepts UUID and rejects junk", () => {
  assert.equal(
    parseDiscoverSubjectId(
      "2F1A9C3E-4B55-4D21-9C8A-1234567890AB",
    ),
    "2f1a9c3e-4b55-4d21-9c8a-1234567890ab",
  );
  assert.equal(parseDiscoverSubjectId("lee-da-hye"), null);
  assert.equal(parseDiscoverSubjectId(""), null);
});

test("buildSubjectLandingPath uses cheerleader and kpop segments", () => {
  assert.equal(
    buildSubjectLandingPath("en", "cheer", "lee-da-hye"),
    "/cheerleader/lee-da-hye",
  );
  assert.equal(
    buildSubjectLandingPath("ko", "cheer", "lee-da-hye"),
    "/ko/cheerleader/lee-da-hye",
  );
  assert.equal(
    buildSubjectLandingPath("zh-tw", "kpop", "aespa-karina"),
    "/zh-tw/kpop/aespa-karina",
  );
});

test("resolveSubjectDisplayName follows locale fallbacks", () => {
  const subject = {
    name_ko: "이다혜",
    name_en: "Lee Da-hye",
    name_zh_tw: "李多惠",
  };

  assert.equal(resolveSubjectDisplayName("en", subject), "Lee Da-hye");
  assert.equal(resolveSubjectDisplayName("ko", subject), "이다혜");
  assert.equal(resolveSubjectDisplayName("zh-tw", subject), "李多惠");
  assert.equal(
    resolveSubjectDisplayName("zh-tw", {
      name_ko: "카리나",
      name_en: "Karina",
      name_zh_tw: null,
    }),
    "Karina",
  );
});

test("cheer metadata templates match locale copy", () => {
  const ko = buildSubjectLandingCopy({
    locale: "ko",
    category: "cheer",
    type: "person",
    name: "이다혜",
  });
  const en = buildSubjectLandingCopy({
    locale: "en",
    category: "cheer",
    type: "person",
    name: "Lee Da-hye",
  });
  const zh = buildSubjectLandingCopy({
    locale: "zh-tw",
    category: "cheer",
    type: "person",
    name: "李多惠",
  });

  assert.equal(ko.title, "이다혜 치어리더 직캠 | Kovemu");
  assert.equal(ko.h1, "이다혜 치어리더 직캠");
  assert.equal(en.title, "Lee Da-hye Cheerleader Fancams | Kovemu");
  assert.equal(zh.title, "李多惠 韓國啦啦隊直拍 | Kovemu");
});

test("kpop person can include a single group name", () => {
  const copy = buildSubjectLandingCopy({
    locale: "ko",
    category: "kpop",
    type: "person",
    name: "카리나",
    groupName: "aespa",
  });

  assert.equal(copy.title, "카리나 직캠 | aespa | Kovemu");
  assert.equal(copy.h1, "카리나 직캠");
});

test("subject landing hreflang shares the same slug", () => {
  const languages = subjectLandingHreflang("cheer", "lee-da-hye");

  assert.equal(
    languages.en,
    "https://kovemu.com/cheerleader/lee-da-hye",
  );
  assert.equal(
    languages["ko-KR"],
    "https://kovemu.com/ko/cheerleader/lee-da-hye",
  );
  assert.equal(
    languages["x-default"],
    "https://kovemu.com/cheerleader/lee-da-hye",
  );
});

test("shouldIndexSubjectLanding requires at least 5 works", () => {
  assert.equal(shouldIndexSubjectLanding(4), false);
  assert.equal(shouldIndexSubjectLanding(5), true);
});
