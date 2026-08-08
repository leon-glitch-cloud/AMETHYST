import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BeadSearchTable, type Bead } from "@/app/beads/_components/bead-search-table";

async function getBeads(): Promise<Bead[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beads")
      .select(
        "id, article_number, name, material, image_url, size_mm, color, unit_price"
      )
      .order("article_number", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export default async function BeadsPage() {
  const beads = await getBeads();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-gray-900">Perlenbestand</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/beads/import"
            className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
          >
            Bestellliste importieren
          </Link>
          <Link
            href="/beads/new"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            + Neue Perle
          </Link>
        </div>
      </div>

      <BeadSearchTable beads={beads} />

      <Link
        href="/"
        className="mt-8 inline-block text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
      >
        Zurück zur Startseite
      </Link>
    </main>
  );
}
