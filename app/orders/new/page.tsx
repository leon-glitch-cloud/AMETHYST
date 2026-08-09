import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrder } from "@/app/orders/actions";
import { BackLink } from "@/app/_components/back-link";
import { SubmitButton } from "@/app/_components/submit-button";

type BraceletOption = { id: string; name: string };

async function getBracelets(): Promise<BraceletOption[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bracelets")
      .select("id, name")
      .order("name", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const bracelets = await getBracelets();

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <BackLink href="/" />

      <h1 className="mb-6 text-2xl font-medium text-gray-900">
        Neue Bestellung
      </h1>

      <form action={createOrder} className="space-y-4">
        <div>
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="customer_name"
          >
            Name
          </label>
          <input
            id="customer_name"
            name="customer_name"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="bracelet_id"
          >
            Armband-Modell
          </label>
          <select
            id="bracelet_id"
            name="bracelet_id"
            defaultValue=""
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          >
            <option value="">— kein Modell —</option>
            {bracelets.map((bracelet) => (
              <option key={bracelet.id} value={bracelet.id}>
                {bracelet.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="wish_text"
          >
            oder: Wunsch-Beschreibung
          </label>
          <textarea
            id="wish_text"
            name="wish_text"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Entweder ein Modell wählen oder einen Wunsch-Text eintragen,
            nicht beides.
          </p>
        </div>

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
          <Link
            href="/"
            className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </main>
  );
}
