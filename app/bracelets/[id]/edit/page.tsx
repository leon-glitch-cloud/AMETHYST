import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateBracelet } from "@/app/bracelets/actions";
import { Field } from "@/app/beads/_components/field";
import {
  BeadPicker,
  type BeadOption,
  type BeadItem,
} from "@/app/bracelets/_components/bead-picker";

type Bracelet = {
  id: string;
  name: string;
  photo_url: string | null;
  made_count: number;
  notes: string | null;
};

async function getBracelet(id: string): Promise<Bracelet | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bracelets")
      .select("id, name, photo_url, made_count, notes")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function getBraceletBeadItems(id: string): Promise<BeadItem[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bracelet_beads")
      .select("bead_id, quantity")
      .eq("bracelet_id", id);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

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

export default async function EditBraceletPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [bracelet, initialItems, allBeads] = await Promise.all([
    getBracelet(id),
    getBraceletBeadItems(id),
    getAllBeads(),
  ]);

  if (!bracelet) {
    notFound();
  }

  const updateBraceletWithId = updateBracelet.bind(null, id);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-medium text-gray-900">
        Armband bearbeiten
      </h1>

      <form action={updateBraceletWithId} className="space-y-4">
        <Field
          label="Name"
          name="name"
          defaultValue={bracelet.name}
          required
        />

        <div>
          <label className="mb-1 block text-sm text-gray-600" htmlFor="photo">
            Foto{bracelet.photo_url ? " (ersetzen)" : ""}
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            className="block w-full text-sm text-gray-600"
          />
        </div>

        <Field
          label="Hergestellte Menge"
          name="made_count"
          type="number"
          step="1"
          defaultValue={bracelet.made_count}
        />

        <div>
          <label className="mb-1 block text-sm text-gray-600" htmlFor="notes">
            Notizen
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={bracelet.notes ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <BeadPicker allBeads={allBeads} initialItems={initialItems} />

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Speichern
          </button>
          <Link
            href={`/bracelets/${id}`}
            className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </main>
  );
}
