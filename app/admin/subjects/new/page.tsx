import Link from "next/link";

import SubjectForm from "@/components/admin/SubjectForm";

export default function NewSubjectPage() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/admin/subjects"
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Subjects
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          New Subject
        </h1>
        <p className="mt-2 mb-8 text-sm text-zinc-500">
          Register a person or group first. Works are classified from aliases.
        </p>
        <SubjectForm mode="create" />
      </div>
    </main>
  );
}
