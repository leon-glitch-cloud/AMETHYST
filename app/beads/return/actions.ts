"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseNumber } from "@/lib/forms";

function parseReturnItems(
  formData: FormData
): { bead_id: string; quantity: number; refund_amount: number }[] {
  const beadIds = formData.getAll("bead_id");
  const quantities = formData.getAll("quantity");
  const refundAmounts = formData.getAll("refund_amount");
  const items: { bead_id: string; quantity: number; refund_amount: number }[] =
    [];

  beadIds.forEach((rawId, index) => {
    if (typeof rawId !== "string" || rawId.trim() === "") return;
    const quantity = parseNumber(quantities[index] ?? null);
    if (!quantity || quantity <= 0) return;
    const refundAmount = parseNumber(refundAmounts[index] ?? null) ?? 0;
    items.push({ bead_id: rawId, quantity, refund_amount: refundAmount });
  });

  return items;
}

export async function createBeadReturn(formData: FormData) {
  const items = parseReturnItems(formData);
  if (items.length === 0) {
    redirect(
      `/beads/return?error=${encodeURIComponent(
        "Mindestens eine Perle mit Menge auswählen"
      )}`
    );
  }

  const total = items.reduce((sum, item) => sum + item.refund_amount, 0);
  const supabase = createSupabaseServerClient();

  const { data: transactionRow, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      date: new Date().toISOString().slice(0, 10),
      type: "refund",
      description: `Rücksendung Perlen (${items.length} Position${
        items.length === 1 ? "" : "en"
      })`,
      amount: total,
    })
    .select("id")
    .single();

  if (transactionError || !transactionRow) {
    redirect(
      `/beads/return?error=${encodeURIComponent(
        "Rücksendung konnte nicht gespeichert werden"
      )}`
    );
  }

  const { data: returnRow, error: returnError } = await supabase
    .from("bead_returns")
    .insert({ transaction_id: transactionRow.id })
    .select("id")
    .single();

  if (returnError || !returnRow) {
    await supabase.from("transactions").delete().eq("id", transactionRow.id);
    redirect(
      `/beads/return?error=${encodeURIComponent(
        "Rücksendung konnte nicht gespeichert werden"
      )}`
    );
  }

  const { error: itemsError } = await supabase.from("bead_return_items").insert(
    items.map((item) => ({
      bead_return_id: returnRow.id,
      bead_id: item.bead_id,
      quantity: item.quantity,
      refund_amount: item.refund_amount,
    }))
  );

  if (itemsError) {
    await supabase.from("bead_returns").delete().eq("id", returnRow.id);
    await supabase.from("transactions").delete().eq("id", transactionRow.id);
    redirect(
      `/beads/return?error=${encodeURIComponent(
        "Rücksendung konnte nicht gespeichert werden"
      )}`
    );
  }

  // Bestand reduzieren – best effort, keine harte Transaktion nötig für
  // dieses interne Tool mit 2–3 Nutzern.
  for (const item of items) {
    const { data: bead } = await supabase
      .from("beads")
      .select("stock_count")
      .eq("id", item.bead_id)
      .maybeSingle();

    if (bead) {
      await supabase
        .from("beads")
        .update({ stock_count: Math.max(0, bead.stock_count - item.quantity) })
        .eq("id", item.bead_id);
    }
  }

  redirect("/beads");
}
