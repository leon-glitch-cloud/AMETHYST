import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmMaterialOrder } from "@/app/beads/import/actions";
import {
  MaterialOrderItemsEditor,
  type MaterialOrderItem,
} from "@/app/beads/import/_components/material-order-items-editor";

type MaterialOrder = {
  id: string;
  status: "pending" | "confirmed";
  extracted_json: { items: MaterialOrderItem[] } | null;
};

async function getMaterialOrder(id: string): Promise<MaterialOrder | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("material_orders")
      .select("id, status, extracted_json")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function MaterialOrderReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const materialOrder = await getMaterialOrder(id);

  if (!materialOrder) {
    notFound();
  }

  if (materialOrder.status !== "pending") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-gray-700">
          Diese Bestellliste wurde bereits übernommen.
        </p>
        <Link
          href="/beads"
          className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
        >
          Zurück zum Perlenbestand
        </Link>
      </main>
    );
  }

  const confirmMaterialOrderWithId = confirmMaterialOrder.bind(null, id);
  const items = materialOrder.extracted_json?.items ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <h1 className="mb-2 text-2xl font-medium text-gray-900">
        Bestellliste prüfen
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Vorschlag der KI — bitte prüfen und bei Bedarf korrigieren, bevor du
        übernimmst.
      </p>

      <form action={confirmMaterialOrderWithId} className="space-y-4">
        <MaterialOrderItemsEditor initialItems={items} />

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Übernehmen
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
