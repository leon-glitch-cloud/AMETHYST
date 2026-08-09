import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateOrder } from "@/app/orders/actions";
import { getBraceletModels, parseAutoWishText } from "@/lib/bracelet-models";
import {
  OrderModelPicker,
  NEW_MODEL_KEY,
} from "@/app/orders/new/_components/order-model-picker";
import { BackLink } from "@/app/_components/back-link";
import { SubmitButton } from "@/app/_components/submit-button";

type OrderForEdit = {
  id: string;
  customer_name: string;
  bracelet_id: string | null;
  wish_text: string | null;
  notes: string | null;
  status: "open" | "done" | "cancelled";
};

async function getOrder(id: string): Promise<OrderForEdit | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("orders")
      .select("id, customer_name, bracelet_id, wish_text, notes, status")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function EditOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  if (order.status !== "open") {
    redirect(`/orders/${id}`);
  }

  const models = await getBraceletModels();

  let initialModelKey = "";
  let initialSize = "";
  let initialNewModelName = "";
  let initialWishText = order.wish_text ?? "";

  if (order.bracelet_id) {
    for (const model of models) {
      const match = model.sizes.find((size) => size.id === order.bracelet_id);
      if (match) {
        initialModelKey = model.key;
        initialSize = match.size ?? "";
        break;
      }
    }
  } else if (order.wish_text) {
    const parsed = parseAutoWishText(order.wish_text);
    if (parsed) {
      const matchedModel = models.find(
        (model) => model.name === parsed.modelName
      );
      if (matchedModel) {
        initialModelKey = matchedModel.key;
      } else {
        initialModelKey = NEW_MODEL_KEY;
        initialNewModelName = parsed.modelName;
      }
      initialSize = parsed.size;
      initialWishText = "";
    }
  }

  const updateOrderWithId = updateOrder.bind(null, id);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <BackLink href={`/orders/${id}`} />

      <h1 className="mb-6 text-2xl font-medium text-gray-900">
        Bestellung bearbeiten
      </h1>

      <form action={updateOrderWithId} className="space-y-4">
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
            defaultValue={order.customer_name}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <OrderModelPicker
          models={models}
          initialModelKey={initialModelKey}
          initialSize={initialSize}
          initialNewModelName={initialNewModelName}
          initialWishText={initialWishText}
        />

        <div>
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="notes"
          >
            Anmerkungen
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={order.notes ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
          <Link
            href={`/orders/${id}`}
            className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </main>
  );
}
