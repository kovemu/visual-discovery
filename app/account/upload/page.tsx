"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/client";
import { optimizeImage } from "@/lib/images/optimizeImage";

export default function UploadPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0] ?? null;

    setFile(selectedFile);
    setMessage("");

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (selectedFile) {
      setPreviewUrl(URL.createObjectURL(selectedFile));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!file) {
      setMessage("Choose an image first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You need to log in first.");
      setLoading(false);
      return;
    }

    const { data: creator, error: creatorError } =
      await supabase
        .from("creators")
        .select("id")
        .eq("user_id", user.id)
        .single();

    if (creatorError || !creator) {
      setMessage("Create your creator profile first.");
      setLoading(false);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
  setMessage("Image must be smaller than 10MB.");
  setLoading(false);
  return;
}

let optimizedFile: File;

try {
  optimizedFile = await optimizeImage(file);
} catch {
  setMessage("Image optimization failed.");
  setLoading(false);
  return;
}

const fileName = `${crypto.randomUUID()}.webp`;

const filePath = `${user.id}/${fileName}`;

const { error: uploadError } = await supabase.storage
  .from("creator-images")
  .upload(filePath, optimizedFile, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/webp",
  });

    if (uploadError) {
      setMessage(uploadError.message);
      setLoading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("creator-images")
      .getPublicUrl(filePath);

    const { error: postError } = await supabase
      .from("posts")
      .insert({
        creator_id: creator.id,
        image_url: publicUrl,
        caption: caption.trim() || null,
      });

    if (postError) {
      setMessage(postError.message);
      setLoading(false);
      return;
    }

    router.push("/account");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-600">
          Creator
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-950">
          Upload your work
        </h1>

        <p className="mt-3 text-gray-500">
          Share your latest work on Kovemu.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-7"
        >
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Image
            </label>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              required
              className="block w-full rounded-xl border border-gray-200 p-3 text-sm"
            />
          </div>

          {previewUrl && (
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <img
                src={previewUrl}
                alt="Upload preview"
                className="max-h-[600px] w-full object-contain"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Caption
            </label>

            <textarea
              value={caption}
              onChange={(event) =>
                setCaption(event.target.value)
              }
              rows={4}
              maxLength={300}
              placeholder="Tell people about this work..."
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-fuchsia-400"
            />

            <div className="mt-2 text-right text-sm text-gray-400">
              {caption.length}/300
            </div>
          </div>

          {message && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-full bg-fuchsia-600 px-8 font-bold text-white transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Uploading..." : "Upload Work"}
          </button>
        </form>
      </div>
    </main>
  );
}