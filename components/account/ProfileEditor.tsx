"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { optimizeImage } from "@/lib/images/optimizeImage";

type CreatorProfile = {
  id: string;
  name: string;
  username: string;
  category: string;
  bio: string | null;
  profile_image: string | null;
};

type ProfileEditorProps = {
  creator: CreatorProfile;
  userId: string;
};

const categories = [
  "Music",
  "Dance",
  "Film",
  "Art",
  "Cosplay",
];

export default function ProfileEditor({
  creator,
  userId,
}: ProfileEditorProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(creator.name);
  const [username, setUsername] = useState(
    creator.username,
  );
  const [category, setCategory] = useState(
    creator.category,
  );
  const [bio, setBio] = useState(
    creator.bio ?? "",
  );

  const [profileImage, setProfileImage] =
    useState(creator.profile_image ?? "");

  const [profileFile, setProfileFile] =
    useState<File | null>(null);

  const [profilePreview, setProfilePreview] =
    useState<string | null>(
      creator.profile_image ?? null,
    );

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleProfileImageChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile =
      event.target.files?.[0] ?? null;

    if (!selectedFile) {
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setMessage("Image must be smaller than 10MB.");
      return;
    }

    if (
      profilePreview &&
      profilePreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(profilePreview);
    }

    setProfileFile(selectedFile);
    setProfilePreview(
      URL.createObjectURL(selectedFile),
    );
    setMessage("");
  };

  const handleCancel = () => {
    if (
      profilePreview &&
      profilePreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(profilePreview);
    }

    setName(creator.name);
    setUsername(creator.username);
    setCategory(creator.category);
    setBio(creator.bio ?? "");

    setProfileImage(
      creator.profile_image ?? "",
    );
    setProfileFile(null);
    setProfilePreview(
      creator.profile_image ?? null,
    );

    setMessage("");
    setEditing(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage("Artist name is required.");
      return;
    }

    if (!username.trim()) {
      setMessage("Username is required.");
      return;
    }

    setLoading(true);
    setMessage("");

    let nextProfileImage = profileImage;

    if (profileFile) {
      try {
        const optimizedFile =
          await optimizeImage(profileFile);

        const filePath =
          `${userId}/profile-${crypto.randomUUID()}.webp`;

        const { error: uploadError } =
          await supabase.storage
            .from("creator-images")
            .upload(
              filePath,
              optimizedFile,
              {
                cacheControl: "3600",
                upsert: false,
                contentType: "image/webp",
              },
            );

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

        nextProfileImage = publicUrl;
      } catch {
        setMessage(
          "Profile image optimization failed.",
        );
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase
      .from("creators")
      .update({
        name: name.trim(),
        username: username.trim(),
        category,
        bio: bio.trim() || null,
        profile_image:
          nextProfileImage || null,
      })
      .eq("id", creator.id);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setProfileImage(nextProfileImage);
    setProfileFile(null);
    setProfilePreview(
      nextProfileImage || null,
    );

    setLoading(false);
    setEditing(false);

    router.refresh();
  };

  if (editing) {
    return (
      <section className="mt-10 rounded-2xl border border-gray-200 p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500">
              Artist Profile
            </p>

            <h2 className="mt-2 text-2xl font-black text-gray-950">
              Edit Profile
            </h2>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            className="text-sm font-semibold text-gray-500 transition hover:text-gray-900"
          >
            Cancel
          </button>
        </div>

        <div className="mt-8 space-y-6">
          {/* Profile image */}
          <div>
            <label className="mb-3 block text-sm font-bold text-gray-800">
              Profile image
            </label>

            <div className="flex items-center gap-5">
              <label className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full bg-gray-100">
  {profilePreview ? (
    <img
      src={profilePreview}
      alt="Profile preview"
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="flex h-full items-center justify-center text-xs text-gray-400">
      No image
    </div>
  )}

  <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-bold text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
    Change
  </div>

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={handleProfileImageChange}
    className="hidden"
  />
</label>

              <label className="cursor-pointer rounded-full border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:border-fuchsia-300 hover:text-fuchsia-600">
                Change image

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handleProfileImageChange
                  }
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Artist name */}
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Artist name
            </label>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              maxLength={80}
              className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none transition focus:border-fuchsia-400"
            />
          </div>

          {/* Username */}
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Username
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                @
              </span>

              <input
                value={username}
                onChange={(event) =>
                  setUsername(
                    event.target.value,
                  )
                }
                maxLength={40}
                className="h-12 w-full rounded-xl border border-gray-200 pl-8 pr-4 outline-none transition focus:border-fuchsia-400"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Category
            </label>

            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 outline-none transition focus:border-fuchsia-400"
            >
              {categories.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Bio */}
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Bio
            </label>

            <textarea
              value={bio}
              onChange={(event) =>
                setBio(event.target.value)
              }
              rows={5}
              maxLength={500}
              placeholder="Tell people about your work..."
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-fuchsia-400"
            />

            <div className="mt-2 text-right text-sm text-gray-400">
              {bio.length}/500
            </div>
          </div>

          {message && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="h-12 rounded-full bg-fuchsia-600 px-8 font-bold text-white transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Saving..."
              : "Save Changes"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-2xl border border-gray-200 p-8">
      <div className="flex items-start gap-5">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-gray-100">
          {creator.profile_image ? (
            <img
              src={creator.profile_image}
              alt={`${creator.name} profile`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              No image
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-500">
            Artist Profile
          </p>

          <h2 className="mt-2 text-3xl font-black text-gray-950">
            {creator.name}
          </h2>

          <p className="mt-1 text-gray-500">
            @{creator.username}
          </p>

          <p className="mt-3 text-sm font-semibold text-fuchsia-600">
            {creator.category}
          </p>
        </div>
      </div>

      {creator.bio && (
        <p className="mt-6 max-w-2xl leading-7 text-gray-600">
          {creator.bio}
        </p>
      )}

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href={`/creator/${creator.id}`}
          className="inline-flex rounded-full border border-gray-200 px-6 py-3 font-bold text-gray-800 transition hover:border-fuchsia-300 hover:text-fuchsia-600"
        >
          View Artist Profile
        </Link>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex rounded-full border border-gray-200 px-6 py-3 font-bold text-gray-800 transition hover:border-fuchsia-300 hover:text-fuchsia-600"
        >
          Edit Profile
        </button>
      </div>
    </section>
  );
}