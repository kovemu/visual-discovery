import assert from "node:assert/strict";
import { test } from "node:test";

import { matchWorksToSubjects } from "@/lib/subjects/matchSubjectAliases";
import { normalizeSubjectAlias } from "@/lib/subjects/normalizeSubjectText";
import type {
  SubjectCategory,
  SubjectGroupMembership,
  SubjectMatchMode,
  SubjectType,
} from "@/lib/subjects/subjectTypes";

function subject(input: {
  id: string;
  type?: SubjectType;
  category?: SubjectCategory;
  aliases: Array<{
    alias: string;
    matchMode?: SubjectMatchMode;
    auto?: boolean;
  }>;
}) {
  return {
    id: input.id,
    type: input.type ?? "person",
    category: input.category ?? "cheer",
    active: true,
    aliases: input.aliases.map((alias) => ({
      alias: alias.alias,
      normalized_alias: normalizeSubjectAlias(alias.alias),
      match_mode: alias.matchMode ?? "substring",
      auto_match_enabled: alias.auto !== false,
    })),
  };
}

function membership(
  personSubjectId: string,
  groupSubjectId: string,
  relationType: SubjectGroupMembership["relationType"] = "current",
): SubjectGroupMembership {
  return {
    personSubjectId,
    groupSubjectId,
    relationType,
    active: true,
  };
}

test("A: Hangul substring matches hashtag and spaced name", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 1,
        title: "유니폼 찰떡! LG 양효주 치어리더 #양효주",
        description: null,
        artistName: "CheerS & Sports",
        effectiveCategory: "cheer",
      },
    ],
    [subject({ id: "yang", aliases: [{ alias: "양효주" }] })],
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.subjectId, "yang");
  assert.equal(result.matches[0]?.source, "auto_title");
});

test("B: description-only Hangul match uses auto_description", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 2,
        title: "타이밍 뭣?",
        description: "260717 이예빈 치어리더 직캠 #이예빈",
        artistName: "Spinel CAM",
        effectiveCategory: "cheer",
      },
    ],
    [subject({ id: "yebin", aliases: [{ alias: "이예빈" }] })],
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.subjectId, "yebin");
  assert.equal(result.matches[0]?.source, "auto_description");
});

test("C: substring matches Hangul name without spaces", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 3,
        title: "25-26 kb스타즈 정설아치어리더 응원 직캠",
        description: null,
        artistName: null,
        effectiveCategory: "cheer",
      },
    ],
    [subject({ id: "seola", aliases: [{ alias: "정설아" }] })],
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.subjectId, "seola");
});

test("D: token AHYEON matches, ASA does not match inside asababymonster", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 4,
        title: "Ahyeon LIKE THAT Fancam #asababymonster#ahyeon",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    [
      subject({
        id: "asa",
        category: "kpop",
        aliases: [{ alias: "ASA", matchMode: "token" }],
      }),
      subject({
        id: "ahyeon",
        category: "kpop",
        aliases: [{ alias: "AHYEON", matchMode: "token" }],
      }),
    ],
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.subjectId, "ahyeon");
  assert.equal(
    result.matches.some((match) => match.subjectId === "asa"),
    false,
  );
});

test("E: many-to-many person and group aliases can all match", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 5,
        title:
          "같은 시기에 컴백한 장원영 카리나 실물 #WONYOUNG #KARINA #아이브 #IVE #에스파 #aespa",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    [
      subject({
        id: "wonyoung",
        type: "person",
        category: "kpop",
        aliases: [{ alias: "장원영" }],
      }),
      subject({
        id: "ive",
        type: "group",
        category: "kpop",
        aliases: [{ alias: "IVE", matchMode: "token" }, { alias: "아이브" }],
      }),
      subject({
        id: "karina",
        type: "person",
        category: "kpop",
        aliases: [{ alias: "카리나" }],
      }),
      subject({
        id: "aespa",
        type: "group",
        category: "kpop",
        aliases: [{ alias: "aespa", matchMode: "token" }, { alias: "에스파" }],
      }),
    ],
    [
      membership("wonyoung", "ive"),
      membership("karina", "aespa"),
    ],
  );

  assert.equal(result.matches.length, 4);
  assert.deepEqual(
    result.matches.map((match) => match.subjectId).sort(),
    ["aespa", "ive", "karina", "wonyoung"],
  );
});

test("F: uploader artist_name is not treated as a subject", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 6,
        title: "김해리 치어리더",
        description: null,
        artistName: "CheerS & Sports",
        effectiveCategory: "cheer",
      },
    ],
    [
      subject({ id: "haeri", aliases: [{ alias: "김해리" }] }),
      subject({
        id: "cheers",
        aliases: [{ alias: "CheerS", matchMode: "substring" }],
      }),
    ],
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.subjectId, "haeri");
});

test("G: ambiguous alias in the same category is skipped", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 7,
        title: "지원 직캠",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    [
      subject({
        id: "jiwon-a",
        category: "kpop",
        aliases: [{ alias: "지원", matchMode: "token" }],
      }),
      subject({
        id: "jiwon-b",
        category: "kpop",
        aliases: [{ alias: "지원", matchMode: "token" }],
      }),
    ],
  );

  assert.equal(result.matches.length, 0);
  assert.equal(result.skippedAmbiguousAliases.length, 1);
  assert.equal(result.skippedAmbiguousAliases[0]?.normalizedAlias, "지원");
});

test("token ASA matches a standalone hashtag token", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 8,
        title: "#ASA fancam",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    [
      subject({
        id: "asa",
        category: "kpop",
        aliases: [{ alias: "ASA", matchMode: "token" }],
      }),
    ],
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.subjectId, "asa");
});

test("A: title match blocks description-only subjects", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 11,
        title: "문성주 등장곡 - 계유진 Kye Yu-Jin Cheerleader",
        description: "#계유진 #이주은",
        artistName: "CheerS & Sports",
        effectiveCategory: "cheer",
      },
    ],
    [
      subject({ id: "gyeyujin", aliases: [{ alias: "계유진" }] }),
      subject({ id: "jueun", aliases: [{ alias: "이주은" }] }),
    ],
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.subjectId, "gyeyujin");
  assert.equal(result.matches[0]?.source, "auto_title");
  assert.equal(
    result.matches.some((match) => match.subjectId === "jueun"),
    false,
  );
});

test("C: title many-to-many ignores description-only aliases", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 12,
        title: "KT 비주얼 계유진X김진아X김해리 치어리더",
        description: "#이서윤",
        artistName: null,
        effectiveCategory: "cheer",
      },
    ],
    [
      subject({ id: "gyeyujin", aliases: [{ alias: "계유진" }] }),
      subject({ id: "jinah", aliases: [{ alias: "김진아" }] }),
      subject({ id: "haeri", aliases: [{ alias: "김해리" }] }),
      subject({ id: "seoyoon", aliases: [{ alias: "이서윤" }] }),
    ],
  );

  assert.equal(result.matches.length, 3);
  assert.deepEqual(
    result.matches.map((match) => match.subjectId).sort(),
    ["gyeyujin", "haeri", "jinah"],
  );
  assert.ok(result.matches.every((match) => match.source === "auto_title"));
  assert.equal(
    result.matches.some((match) => match.subjectId === "seoyoon"),
    false,
  );
});

test("D: artist_name alone does not match a subject", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 13,
        title: "유진이 포포를 해달라는 말이 생각나서 해봤어 #아이브",
        description: "",
        artistName: "계유진",
        effectiveCategory: "cheer",
      },
    ],
    [subject({ id: "gyeyujin", aliases: [{ alias: "계유진" }] })],
  );

  assert.equal(result.matches.length, 0);
});

test("E: empty title falls back to description for multiple subjects", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 14,
        title: "",
        description: "김해리 양효주 치어리더",
        artistName: null,
        effectiveCategory: "cheer",
      },
    ],
    [
      subject({ id: "haeri", aliases: [{ alias: "김해리" }] }),
      subject({ id: "hyoju", aliases: [{ alias: "양효주" }] }),
    ],
  );

  assert.equal(result.matches.length, 2);
  assert.deepEqual(
    result.matches.map((match) => match.subjectId).sort(),
    ["haeri", "hyoju"],
  );
  assert.ok(
    result.matches.every((match) => match.source === "auto_description"),
  );
});

test("kpop alias does not auto-match a cheer work", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 10,
        title: "IVE 직캠",
        description: null,
        artistName: null,
        effectiveCategory: "cheer",
      },
    ],
    [
      subject({
        id: "ive",
        type: "group",
        category: "kpop",
        aliases: [{ alias: "IVE", matchMode: "token" }],
      }),
    ],
  );

  assert.equal(result.matches.length, 0);
});

test("K-pop A: original artist tag is dropped without membership", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 21,
        title:
          "치마가 심하게 짧은데\n#백지헌 #프로미스나인 #fromis_9 #AOA\n♬ Miniskirt",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    [
      subject({
        id: "jiheon",
        category: "kpop",
        aliases: [{ alias: "백지헌" }],
      }),
      subject({
        id: "fromis9",
        type: "group",
        category: "kpop",
        aliases: [
          { alias: "프로미스나인" },
          { alias: "fromis_9" },
        ],
      }),
      subject({
        id: "aoa",
        type: "group",
        category: "kpop",
        aliases: [{ alias: "AOA", matchMode: "token" }],
      }),
    ],
    [membership("jiheon", "fromis9")],
  );

  assert.deepEqual(
    result.matches.map((match) => match.subjectId).sort(),
    ["fromis9", "jiheon"],
  );
  assert.ok(result.matches.every((match) => match.source === "auto_title"));
  assert.equal(
    result.matches.some((match) => match.subjectId === "aoa"),
    false,
  );
});

test("K-pop B: hashtag persons ignore prose comparison names", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 22,
        title:
          "권은비 이기겠다던 채영이\n#이채영 #LEECHAEYOUNG\n#프로미스나인",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    [
      subject({
        id: "eunbi",
        category: "kpop",
        aliases: [{ alias: "권은비" }],
      }),
      subject({
        id: "chaeyoung",
        category: "kpop",
        aliases: [
          { alias: "이채영" },
          { alias: "LEECHAEYOUNG", matchMode: "token" },
        ],
      }),
      subject({
        id: "fromis9",
        type: "group",
        category: "kpop",
        aliases: [{ alias: "프로미스나인" }],
      }),
    ],
    [membership("chaeyoung", "fromis9")],
  );

  assert.deepEqual(
    result.matches.map((match) => match.subjectId).sort(),
    ["chaeyoung", "fromis9"],
  );
  assert.equal(
    result.matches.some((match) => match.subjectId === "eunbi"),
    false,
  );
});

const nanaSubjects = [
  subject({
    id: "wooah-nana",
    category: "kpop",
    aliases: [
      { alias: "나나" },
      { alias: "NANA", matchMode: "token" },
    ],
  }),
  subject({
    id: "unis-nana",
    category: "kpop",
    aliases: [
      { alias: "나나" },
      { alias: "NANA", matchMode: "token" },
    ],
  }),
  subject({
    id: "wooah",
    type: "group" as const,
    category: "kpop" as const,
    aliases: [{ alias: "WOOAH", matchMode: "token" as const }],
  }),
  subject({
    id: "unis",
    type: "group" as const,
    category: "kpop" as const,
    aliases: [{ alias: "UNIS", matchMode: "token" as const }],
  }),
];

const nanaMemberships = [
  membership("wooah-nana", "wooah"),
  membership("unis-nana", "unis"),
];

test("K-pop C: Nana resolves to WOOAH with group context", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 23,
        title: "#나나 #NANA #WOOAH",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    nanaSubjects,
    nanaMemberships,
  );

  assert.deepEqual(
    result.matches.map((match) => match.subjectId).sort(),
    ["wooah", "wooah-nana"],
  );
  assert.equal(
    result.matches.some((match) => match.subjectId === "unis-nana"),
    false,
  );
});

test("K-pop D: Nana resolves to UNIS with group context", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 24,
        title: "#나나 #NANA #UNIS",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    nanaSubjects,
    nanaMemberships,
  );

  assert.deepEqual(
    result.matches.map((match) => match.subjectId).sort(),
    ["unis", "unis-nana"],
  );
});

test("K-pop E: Nana without group context is skipped", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 25,
        title: "#나나 #NANA",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    nanaSubjects,
    nanaMemberships,
  );

  assert.equal(result.matches.length, 0);
  assert.ok(
    result.skippedAmbiguousAliases.some(
      (item) => item.normalizedAlias === "나나" || item.normalizedAlias === "nana",
    ),
  );
});

test("K-pop F: multiple members keep their group", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 26,
        title: "Next Level #윈터 #카리나 #WINTER #KARINA #에스파 #aespa",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    [
      subject({
        id: "winter",
        category: "kpop",
        aliases: [
          { alias: "윈터" },
          { alias: "WINTER", matchMode: "token" },
        ],
      }),
      subject({
        id: "karina",
        category: "kpop",
        aliases: [
          { alias: "카리나" },
          { alias: "KARINA", matchMode: "token" },
        ],
      }),
      subject({
        id: "aespa",
        type: "group",
        category: "kpop",
        aliases: [
          { alias: "에스파" },
          { alias: "aespa", matchMode: "token" },
        ],
      }),
    ],
    [
      membership("winter", "aespa"),
      membership("karina", "aespa"),
    ],
  );

  assert.deepEqual(
    result.matches.map((match) => match.subjectId).sort(),
    ["aespa", "karina", "winter"],
  );
});

test("K-pop G: no hashtags falls back to full title", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 27,
        title: "260725 아이브 안유진 직캠",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    [
      subject({
        id: "yujin",
        category: "kpop",
        aliases: [{ alias: "안유진" }],
      }),
      subject({
        id: "ive",
        type: "group",
        category: "kpop",
        aliases: [
          { alias: "아이브" },
          { alias: "IVE", matchMode: "token" },
        ],
      }),
    ],
    [membership("yujin", "ive")],
  );

  assert.deepEqual(
    result.matches.map((match) => match.subjectId).sort(),
    ["ive", "yujin"],
  );
});

test("K-pop H: group-only match is kept", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 28,
        title: "aespa concert fancam",
        description: null,
        artistName: null,
        effectiveCategory: "kpop",
      },
    ],
    [
      subject({
        id: "aespa",
        type: "group",
        category: "kpop",
        aliases: [{ alias: "aespa", matchMode: "token" }],
      }),
    ],
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.subjectId, "aespa");
  assert.equal(result.matches[0]?.source, "auto_title");
});

test("K-pop I: Cheer regression is unchanged", () => {
  const result = matchWorksToSubjects(
    [
      {
        id: 29,
        title: "양효주 치어리더",
        description: null,
        artistName: null,
        effectiveCategory: "cheer",
      },
    ],
    [subject({ id: "hyoju", aliases: [{ alias: "양효주" }] })],
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.subjectId, "hyoju");
  assert.equal(result.matches[0]?.source, "auto_title");
});
