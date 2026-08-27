import Header from "@/components/Header";
import MyKovemuTabs from "@/components/me/MyKovemuTabs";
import { isRealAccountUser } from "@/lib/auth/userKind";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isRealAccountUser(user)) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <h1 className="text-3xl font-black tracking-tight text-gray-950">
          My Kovemu
        </h1>

        <MyKovemuTabs />
      </div>
    </main>
  );
}
