"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function LogoutButton() {
  const router = useRouter();
  const { t } = useTranslation();
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-full border border-[#262626] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-50 md:px-4 md:py-2 md:text-sm"
    >
      {loading ? t("loggingOut") : t("logout")}
    </button>
  );
}
