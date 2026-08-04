import Link from "next/link";
import { createBead } from "@/app/beads/actions";
import { Field } from "@/app/beads/_components/field";

export default async function NewBeadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-medium text-gray-900">Neue Perle</h1>

      <form action={createBead} className="space-y-4">
        <Field label="Artikelnummer" name="article_number" required />

        <div>
          <label className="mb-1 block text-sm text-gray-600" htmlFor="photo">
            Referenzfoto
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            className="block w-full text-sm text-gray-600"
          />
        </div>

        <Field label="Größe (mm)" name="size_mm" type="number" step="0.1" />
        <Field label="Farbe" name="color" />
        <Field label="Preis (€)" name="unit_price" type="number" step="0.01" />
        <Field label="Shop" name="source_shop" />
        <Field label="Shop-Link" name="source_url" type="url" />
        <Field label="Bestandsmenge" name="stock_count" type="number" step="1" />

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
