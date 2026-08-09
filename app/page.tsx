import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBraceletModels, parseAutoWishText } from "@/lib/bracelet-models";

type OpenOrder = {
  id: string;
  customer_name: string;
  wish_text: string | null;
  bracelet: { id: string; name: string } | null;
};

async function getSaldo(): Promise<number> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from("transactions").select("amount");
    if (error || !data) return 0;
    return data.reduce((sum, row) => sum + Number(row.amount), 0);
  } catch {
    return 0;
  }
}

async function getOpenOrders(): Promise<OpenOrder[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("orders")
      .select("id, customer_name, wish_text, bracelet:bracelets(id, name)")
      .eq("status", "open")
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data as unknown as OpenOrder[];
  } catch {
    return [];
  }
}

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export default async function DashboardPage() {
  const [saldo, openOrders, models] = await Promise.all([
    getSaldo(),
    getOpenOrders(),
    getBraceletModels(),
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-white px-4 py-16">
      <div className="text-center">
        <p className="mb-2 text-sm uppercase tracking-wide text-gray-400">
          Saldo
        </p>
        <p className="text-5xl font-semibold text-gray-900">
          {currencyFormatter.format(saldo)}
        </p>
      </div>

      <section className="w-full max-w-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm uppercase tracking-wide text-gray-400">
            Offene Bestellungen
          </p>
          <Link
            href="/orders/new"
            className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
          >
            + Neue Bestellung
          </Link>
        </div>
        {openOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Keine offenen Bestellungen.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {openOrders.map((order) => {
              const parsedWish = order.wish_text
                ? parseAutoWishText(order.wish_text)
                : null;
              const resolvedModel = parsedWish
                ? (models.find((model) => model.name === parsedWish.modelName) ??
                  null)
                : null;

              return (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-gray-700"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-gray-900">
                      {order.customer_name}
                    </span>{" "}
                    –{" "}
                    {order.bracelet ? (
                      order.bracelet.name
                    ) : resolvedModel && parsedWish ? (
                      <>
                        <Link
                          href={`/bracelets/${resolvedModel.key}?from=${encodeURIComponent("/")}`}
                          className="underline underline-offset-4 hover:text-gray-900"
                        >
                          {resolvedModel.name}
                        </Link>
                        {` (Größe ${parsedWish.size}, noch nicht angelegt)`}
                      </>
                    ) : (
                      order.wish_text
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {order.bracelet && (
                      <Link
                        href={`/bracelets/${order.bracelet.id}?from=${encodeURIComponent("/")}`}
                        className="text-gray-600 underline underline-offset-4 hover:text-gray-900"
                      >
                        Perlen ansehen
                      </Link>
                    )}
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-gray-600 underline underline-offset-4 hover:text-gray-900"
                    >
                      Details
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <nav className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        <NavCard href="/bracelets" label="Armbandbestand" />
        <NavCard href="/beads" label="Perlenbestand" />
        <NavCard href="/transactions" label="Verlauf" />
      </nav>
    </main>
  );
}

function NavCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
    >
      {label}
    </Link>
  );
}
