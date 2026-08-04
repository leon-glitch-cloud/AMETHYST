import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBeadReturn } from "@/app/beads/return/actions";
import {
  BeadReturnPicker,
  type BeadOption,
} from "@/app/beads/return/_components/bead-return-picker";

async function getAllBeads(): Promise<BeadOption[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beads")
      .select("id, article_number, color, size_mm, unit_price")
      .order("article_number", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export default async function BeadReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const allBeads = await getAllBeads();

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-medium text-gray-900">
        Rücksendung erfassen
      </h1>

      <form action={createBeadReturn} className="space-y-4">
        <BeadReturnPicker allBeads={allBeads} />

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Speichern
          </button>
          <Link
            href="/beads"
            className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </main>
  );
}
