"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseNumber, parseText } from "@/lib/forms";
import { createSaleTransaction } from "@/lib/sales";

export async function createOrder(formData: FormData) {
  const customerName = parseText(formData.get("customer_name"));
  if (!customerName) {
    redirect(`/orders/new?error=${encodeURIComponent("Name ist erforderlich")}`);
  }

  const braceletId = parseText(formData.get("bracelet_id"));
  const wishText = parseText(formData.get("wish_text"));

  if ((braceletId && wishText) || (!braceletId && !wishText)) {
    redirect(
      `/orders/new?error=${encodeURIComponent(
        "Entweder ein Modell wählen oder einen Wunsch-Text eintragen, nicht beides oder keins"
      )}`
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("orders").insert({
    customer_name: customerName,
    bracelet_id: braceletId,
    wish_text: wishText,
    status: "open",
  });

  if (error) {
    redirect(
      `/orders/new?error=${encodeURIComponent("Bestellung konnte nicht gespeichert werden")}`
    );
  }

  revalidatePath("/");
  redirect("/");
}

export async function completeOrder(orderId: string, formData: FormData) {
  const buyerName = parseText(formData.get("buyer_name"));
  if (!buyerName) {
    redirect(
      `/orders/${orderId}?error=${encodeURIComponent("Käufer ist erforderlich")}`
    );
  }

  const isGift = formData.get("is_gift") === "yes";
  const price = isGift ? 0 : (parseNumber(formData.get("price")) ?? 0);

  const supabase = createSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, wish_text, bracelet_id, bracelet:bracelets(name)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    redirect(
      `/orders/${orderId}?error=${encodeURIComponent("Bestellung nicht gefunden")}`
    );
  }

  const braceletName =
    (order.bracelet as unknown as { name: string } | null)?.name ??
    order.wish_text ??
    "Bestellung";

  const result = await createSaleTransaction({
    braceletId: order.bracelet_id,
    braceletName,
    buyerName,
    price,
    isGift,
  });

  if (!result.ok) {
    redirect(`/orders/${orderId}?error=${encodeURIComponent(result.message)}`);
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "done", sale_id: result.saleId })
    .eq("id", orderId);

  if (updateError) {
    redirect(
      `/orders/${orderId}?error=${encodeURIComponent(
        "Bestellung konnte nicht aktualisiert werden"
      )}`
    );
  }

  revalidatePath("/");
  redirect(`/orders/${orderId}`);
}

export async function cancelOrder(orderId: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);

  if (error) {
    redirect(
      `/orders/${orderId}?error=${encodeURIComponent(
        "Bestellung konnte nicht storniert werden"
      )}`
    );
  }

  revalidatePath("/");
  redirect(`/orders/${orderId}`);
}
