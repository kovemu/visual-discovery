import { createClient } from "@/lib/supabase/server";

export default async function TestDbPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creators")
    .select("*");

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">Supabase Test</h1>

      {error ? (
        <pre className="mt-6 text-red-600">
          {JSON.stringify(error, null, 2)}
        </pre>
      ) : (
        <pre className="mt-6">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </main>
  );
}