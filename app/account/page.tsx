import Header from "@/components/Header";
import { isRealAccountUser } from "@/lib/auth/userKind";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/account/ProfileEditor";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isRealAccountUser(user)) {
    redirect("/login");
  }

  const { data: creator } = await supabase
    .from("creators")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-4xl px-6 py-16 lg:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-600">
          Account
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-950">
          My Profile
        </h1>

        <p className="mt-3 text-gray-500">
          {user.email}
        </p>

        {creator ? (
          <ProfileEditor
            creator={creator}
            userId={user.id}
          />
        ) : null}
      </div>
    </main>
  );
}
