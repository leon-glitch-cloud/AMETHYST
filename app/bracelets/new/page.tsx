import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBracelet } from "@/app/bracelets/actions";
import { Field } from "@/app/beads/_components/field";
import { type BeadOption } from "@/app/bracelets/_components/bead-picker";
import { BraceletBeadSection } from "@/app/bracelets/_components/bracelet-bead-section";

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

export default async function NewBraceletPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const allBeads = await getAllBeads();

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-medium text-gray-900">
        Neues Armband
      </h1>

      <form action={createBracelet} className="space-y-4">
        <Field label="Name" name="name" required />

        <Field
          label="Hergestellte Menge"
          name="made_count"
          type="number"
          step="1"
        />

        <div>
          <label className="mb-1 block text-sm text-gray-600" htmlFor="notes">
            Notizen
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <BraceletBeadSection allBeads={allBeads} />

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Speichern
          </button>
          <Link
            href="/bracelets"
            className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </main>
  );
}
