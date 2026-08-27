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
      className="shrink-0 text-[13px] font-medium tracking-[0.04em] text-zinc-500 transition hover:text-zinc-200 disabled:opacity-50"
    >
      {loading ? t("loggingOut") : t("logout")}
    </button>
  );
}
