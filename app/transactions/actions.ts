"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseNumber, parseText } from "@/lib/forms";

export async function createBooking(formData: FormData) {
  const description = parseText(formData.get("description"));
  if (!description) {
    redirect(
      `/transactions?error=${encodeURIComponent("Beschreibung ist erforderlich")}`
    );
  }

  const amount = parseNumber(formData.get("amount"));
  if (amount === null || amount <= 0) {
    redirect(
      `/transactions?error=${encodeURIComponent("Betrag muss größer als 0 sein")}`
    );
  }

  const date = parseText(formData.get("date")) ?? new Date().toISOString().slice(0, 10);
  const isIncome = formData.get("booking_type") === "income";
  const person = parseText(formData.get("person"));

  const supabase = createSupabaseServerClient();
  // "refund" ist technisch der Typ, deckt inhaltlich aber jede manuell
  // erfasste Einnahme ab (z. B. ein Verkauf ohne dokumentiertes Armband).
  const { error } = await supabase.from("transactions").insert({
    date,
    type: isIncome ? "refund" : "expense",
    description,
    amount: isIncome ? Math.abs(amount) : -Math.abs(amount),
    person,
  });

  if (error) {
    redirect(
      `/transactions?error=${encodeURIComponent(
        isIncome
          ? "Einnahme konnte nicht gespeichert werden"
          : "Ausgabe konnte nicht gespeichert werden"
      )}`
    );
  }

  revalidatePath("/");
  redirect("/transactions");
}

export async function deleteTransaction(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);

  if (error) {
    redirect(
      `/transactions?error=${encodeURIComponent(
        "Buchung konnte nicht gelöscht werden"
      )}`
    );
  }

  revalidatePath("/");
  redirect("/transactions");
}
