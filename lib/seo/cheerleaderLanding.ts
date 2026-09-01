const SITE_URL = "https://kovemu.com";

export const CHEERLEADER_LANDING_URLS = {
  ko: `${SITE_URL}/ko/cheerleader`,
  zhTw: `${SITE_URL}/zh-tw/cheerleader`,
} as const;

export const cheerleaderLandingHreflang = {
  "ko-KR": CHEERLEADER_LANDING_URLS.ko,
  "zh-TW": CHEERLEADER_LANDING_URLS.zhTw,
  "x-default": CHEERLEADER_LANDING_URLS.ko,
};

export const koCheerleaderLanding = {
  title: "치어리더 직캠 | 한국 치어리더 영상 | Kovemu",
  description:
    "한국 치어리더의 인기 직캠과 최신 영상을 Kovemu에서 발견하세요.",
  h1: "한국 치어리더 직캠",
  intro:
    "한국 치어리더의 인기 직캠과 최신 영상을 한곳에서 발견하세요.",
  canonical: CHEERLEADER_LANDING_URLS.ko,
  openGraphLocale: "ko_KR",
};

export const zhTwCheerleaderLanding = {
  title: "韓國啦啦隊直拍｜熱門啦啦隊影片｜Kovemu",
  description:
    "探索韓國啦啦隊員的熱門直拍與最新表演影片，在 Kovemu 發現更多精彩內容。",
  h1: "韓國啦啦隊直拍",
  intro: "探索韓國啦啦隊員的熱門直拍與最新表演影片。",
  canonical: CHEERLEADER_LANDING_URLS.zhTw,
  openGraphLocale: "zh_TW",
};
