import Link from "next/link";
import { createMaterialOrderUpload } from "@/app/beads/import/actions";
import { FileUploadField } from "@/app/_components/file-upload-field";
import { BackLink } from "@/app/_components/back-link";

export default async function ImportMaterialOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <BackLink href="/beads" />

      <h1 className="mb-2 text-2xl font-medium text-gray-900">
        Bestellliste importieren
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        PDF, Screenshot oder Foto der Bestellbestätigung hochladen — die KI
        liest die Positionen aus, du prüfst und bestätigst sie danach.
      </p>

      <form action={createMaterialOrderUpload} className="space-y-4">
        <FileUploadField
          id="file"
          name="file"
          label="Datei"
          buttonLabel="Datei auswählen"
          accept="application/pdf,image/*"
          required
        />

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Analysieren
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
