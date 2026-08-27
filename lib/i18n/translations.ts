export type Locale = "ko" | "en";

export const LOCALE_STORAGE_KEY = "visual-lang";

export const translations = {
  en: {
    discover: "Discover",
    myPicks: "My Picks",
    all: "All",
    picked: "picked",
    saved: "Saved",
    submit: "Submit",
    save: "Save",
    pick: "Pick",
    savedState: "Saved",
    pickedState: "Picked",
    next: "Next",
    viewOriginal: "View Original",
    login: "Log in",
    logout: "Logout",
    submitClip: "Submit a clip",
    pasteLink: "Paste a YouTube or TikTok link",
    confirm18: "I confirm that everyone depicted in this submission is 18 or older.",
    discoverHint:
      "Tap a clip. Pick what you like. Keep exploring.",
    noWorks: "No clips yet.",
    noSaved: "Nothing picked yet.",
    close: "Close",
    urlPlaceholder: "https://",
    loggingOut: "Logging out...",
    submitNotStored:
      "Submissions are not stored yet. This form is for UI testing only.",
    submitSuccess:
      "Thanks! Your clip is waiting for review.",
    submitInvalidUrl:
      "Please enter a valid YouTube or TikTok link.",
    submitDuplicate:
      "This clip was already submitted.",
    submitLoginRequired:
      "Please log in to submit a clip.",
    submitServerError:
      "Something went wrong. Please try again.",
    submitSafety:
      "Only submit content featuring adults (18+). Non-consensual or illegal content is prohibited.",
    submitting: "Submitting...",
    sourceYoutube: "YouTube",
    sourceTiktok: "TikTok",
    sourceImage: "Image",
  },
  ko: {
    discover: "둘러보기",
    myPicks: "내 픽",
    all: "전체",
    picked: "픽",
    saved: "저장",
    submit: "제보",
    save: "저장",
    pick: "저장",
    savedState: "저장됨",
    pickedState: "저장됨",
    next: "다음",
    viewOriginal: "원본 보기",
    login: "로그인",
    logout: "로그아웃",
    submitClip: "영상 제보",
    pasteLink: "YouTube 또는 TikTok 링크를 붙여넣으세요",
    confirm18:
      "이 콘텐츠에 등장하는 모든 인물이 만 18세 이상임을 확인합니다.",
    discoverHint:
      "영상을 눌러보고, 마음에 들면 저장하세요.",
    noWorks: "아직 클립이 없습니다.",
    noSaved: "저장한 클립이 없습니다.",
    close: "닫기",
    urlPlaceholder: "https://",
    loggingOut: "로그아웃 중...",
    submitNotStored:
      "제보 저장 기능은 아직 준비 중입니다. UI 테스트용입니다.",
    submitSuccess:
      "고마워요! 제출한 영상은 검토 후 공개됩니다.",
    submitInvalidUrl:
      "유효한 YouTube 또는 TikTok 링크를 입력해 주세요.",
    submitDuplicate:
      "이미 제출된 영상입니다.",
    submitLoginRequired:
      "제보하려면 로그인이 필요합니다.",
    submitServerError:
      "문제가 발생했습니다. 다시 시도해 주세요.",
    submitSafety:
      "성인(18+)이 등장하는 콘텐츠만 제출할 수 있습니다. 동의 없는 콘텐츠 및 불법 콘텐츠는 금지됩니다.",
    submitting: "제출 중...",
    sourceYoutube: "YouTube",
    sourceTiktok: "TikTok",
    sourceImage: "Image",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
