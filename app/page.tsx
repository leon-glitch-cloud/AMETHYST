import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OpenOrder = {
  id: string;
  customer_name: string;
  wish_text: string | null;
  bracelet: { name: string } | null;
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
      .select("id, customer_name, wish_text, bracelet:bracelets(name)")
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
  const [saldo, openOrders] = await Promise.all([getSaldo(), getOpenOrders()]);

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

      {openOrders.length > 0 && (
        <section className="w-full max-w-2xl">
          <p className="mb-3 text-sm uppercase tracking-wide text-gray-400">
            Offene Bestellungen
          </p>
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {openOrders.map((order) => (
              <li key={order.id} className="px-4 py-3 text-sm text-gray-700">
                <span className="font-medium text-gray-900">
                  {order.customer_name}
                </span>{" "}
                – {order.bracelet?.name ?? order.wish_text}
              </li>
            ))}
          </ul>
        </section>
      )}

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
