import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateSaleResult =
  | { ok: true; saleId: string | null }
  | { ok: false; message: string };

/**
 * Legt eine Bilanzbuchung (transactions, type=sale) an. Nur wenn braceletId
 * gesetzt ist, wird zusätzlich eine sales-Zeile angelegt (sales.bracelet_id
 * ist not null — Wunsch-Bestellungen ohne Modell erzeugen laut Spec nur die
 * Buchung). Schlägt der sales-Insert fehl, wird die Transaction wieder
 * gelöscht (Kompensation statt echter DB-Transaction).
 */
export async function createSaleTransaction({
  braceletId,
  braceletName,
  buyerName,
  price,
  isGift,
}: {
  braceletId: string | null;
  braceletName: string;
  buyerName: string;
  price: number;
  isGift: boolean;
}): Promise<CreateSaleResult> {
  const supabase = createSupabaseServerClient();

  const { data: transactionRow, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      date: new Date().toISOString().slice(0, 10),
      type: "sale",
      description: `Verkauf: ${braceletName}`,
      amount: price,
      bracelet_id: braceletId,
      counterparty_name: buyerName,
    })
    .select("id")
    .single();

  if (transactionError || !transactionRow) {
    return { ok: false, message: "Verkauf konnte nicht gespeichert werden" };
  }

  if (!braceletId) {
    return { ok: true, saleId: null };
  }

  const { data: saleRow, error: saleError } = await supabase
    .from("sales")
    .insert({
      bracelet_id: braceletId,
      buyer_name: buyerName,
      price,
      is_gift: isGift,
      transaction_id: transactionRow.id,
    })
    .select("id")
    .single();

  if (saleError || !saleRow) {
    await supabase.from("transactions").delete().eq("id", transactionRow.id);
    return { ok: false, message: "Verkauf konnte nicht gespeichert werden" };
  }

  return { ok: true, saleId: saleRow.id };
}
