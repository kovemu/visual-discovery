import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import SharedClipView from "@/components/clip/SharedClipView";
import { getDiscoverWorkById } from "@/lib/discover/getRealDiscoverWorks";

const PUBLIC_SITE_URL = "https://kovemu.com";

type ClipPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const getSharedClip = cache(async (id: string) => {
  return getDiscoverWorkById(id);
});

function buildClipDescription(
  description: string | null | undefined,
) {
  const trimmed = description?.trim();

  if (!trimmed) {
    return "Discover this clip on KOVEMU.";
  }

  return trimmed.length > 200
    ? `${trimmed.slice(0, 197)}...`
    : trimmed;
}

export async function generateMetadata({
  params,
}: ClipPageProps): Promise<Metadata> {
  const { id } = await params;
  const work = await getSharedClip(id);

  if (!work) {
    return {
      title: "Clip not found | KOVEMU",
    };
  }

  const title = work.title?.trim() || "KOVEMU Clip";
  const description = buildClipDescription(
    work.description ?? work.caption,
  );
  const url = `${PUBLIC_SITE_URL}/clip/${work.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "KOVEMU",
      type: "website",
      ...(work.image
        ? {
            images: [{ url: work.image }],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(work.image
        ? {
            images: [work.image],
          }
        : {}),
    },
  };
}

export default async function ClipPage({
  params,
}: ClipPageProps) {
  const { id } = await params;
  const work = await getSharedClip(id);

  if (!work) {
    notFound();
  }

  return <SharedClipView work={work} />;
}
