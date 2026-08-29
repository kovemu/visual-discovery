import { parseSubmissionUrl } from "@/lib/submissions/parseSubmissionUrl";

const SUPPORTED_SUBMISSION_HOSTS = new Set([
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

function normalizeSubmissionHost(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^m\./, "");
}

export function resolveSubmissionUrlError(
  input: string,
): string | null {
  const parsed = parseSubmissionUrl(input);

  if (parsed) {
    return null;
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return "Invalid URL.";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    const host = normalizeSubmissionHost(url.hostname);

    if (!SUPPORTED_SUBMISSION_HOSTS.has(host)) {
      return "Only YouTube and TikTok links are supported.";
    }
  } catch {
    return "Invalid URL.";
  }

  return "Invalid URL.";
}
