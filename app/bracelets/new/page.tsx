import Link from "next/link";
import { createBracelet } from "@/app/bracelets/actions";
import { BraceletBasicsFields } from "@/app/bracelets/_components/bracelet-basics-fields";
import { BackLink } from "@/app/_components/back-link";
import { SubmitButton } from "@/app/_components/submit-button";

export default async function NewBraceletPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <BackLink href="/bracelets" />

      <h1 className="mb-6 text-2xl font-medium text-gray-900">
        Neues Armband
      </h1>

      <form action={createBracelet} className="space-y-4">
        <BraceletBasicsFields />

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="auto_detect_beads" value="yes" />
          Perlen automatisch mit KI erfassen
        </label>

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
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
