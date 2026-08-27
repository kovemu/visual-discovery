import Header from "@/components/Header";
import SavedGrid from "@/components/saved/SavedGrid";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SavedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 md:px-6 lg:px-8">
        <SavedGrid />
      </section>
    </main>
  );
}
