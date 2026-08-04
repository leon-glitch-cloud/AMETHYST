import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeOrder, cancelOrder } from "@/app/orders/actions";
import { ConfirmFormButton } from "@/app/_components/confirm-form-button";

type OrderDetail = {
  id: string;
  customer_name: string;
  wish_text: string | null;
  status: "open" | "done" | "cancelled";
  bracelet: { id: string; name: string } | null;
};

const statusLabels: Record<OrderDetail["status"], string> = {
  open: "Offen",
  done: "Erledigt",
  cancelled: "Storniert",
};

async function getOrder(id: string): Promise<OrderDetail | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("orders")
      .select("id, customer_name, wish_text, status, bracelet:bracelets(id, name)")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as OrderDetail;
  } catch {
    return null;
  }
}

export default async function OrderDetailPage({
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

  const completeOrderWithId = completeOrder.bind(null, id);
  const cancelOrderWithId = cancelOrder.bind(null, id);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <h1 className="mb-1 text-2xl font-medium text-gray-900">
        {order.customer_name}
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        {order.bracelet ? (
          <>
            Modell:{" "}
            <Link
              href={`/bracelets/${order.bracelet.id}`}
              className="underline underline-offset-4 hover:text-gray-900"
            >
              {order.bracelet.name}
            </Link>
          </>
        ) : (
          <>Wunsch: {order.wish_text}</>
        )}
      </p>

      <p className="mb-6 text-sm text-gray-500">
        Status:{" "}
        <span className="font-medium text-gray-900">
          {statusLabels[order.status]}
        </span>
      </p>

      {error && <p className="mb-6 text-sm text-gray-500">{error}</p>}

      {order.status === "open" && (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-400">
              Erledigt
            </h2>
            <form action={completeOrderWithId} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  name="buyer_name"
                  type="text"
                  placeholder="Käufer"
                  defaultValue={order.customer_name}
                  required
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
                />
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Preis (€)"
                  className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" name="is_gift" value="yes" />
                  Geschenk (kein Geld erhalten)
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                >
                  Als erledigt speichern
                </button>
              </div>
            </form>
          </section>

          <ConfirmFormButton
            action={cancelOrderWithId}
            label="Bestellung stornieren"
            confirmMessage="Diese Bestellung wirklich stornieren?"
          />
        </>
      )}

      <div className="mt-8 border-t border-gray-200 pt-4">
        <Link
          href="/"
          className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}
