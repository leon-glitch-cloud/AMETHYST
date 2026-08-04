import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  recordLoan,
  returnLoan,
  recordSale,
  deleteBracelet,
} from "@/app/bracelets/actions";
import { ConfirmFormButton } from "@/app/_components/confirm-form-button";

type Bracelet = {
  id: string;
  name: string;
  photo_url: string | null;
  made_count: number;
  notes: string | null;
};

type BraceletBeadRow = {
  id: string;
  quantity: number;
  bead: {
    id: string;
    article_number: string;
    color: string | null;
    size_mm: number | string | null;
    unit_price: number | string | null;
  } | null;
};

type Sale = {
  id: string;
  sale_date: string;
  buyer_name: string;
  price: number | string;
  is_gift: boolean;
  transaction_id: string | null;
};

type Loan = {
  id: string;
  borrower_name: string;
  loaned_at: string;
  returned_at: string | null;
};

type OpenOrder = {
  id: string;
  customer_name: string;
};

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-DE");
}

async function getBracelet(id: string): Promise<Bracelet | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bracelets")
      .select("id, name, photo_url, made_count, notes")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function getBraceletBeads(id: string): Promise<BraceletBeadRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bracelet_beads")
      .select(
        "id, quantity, bead:beads(id, article_number, color, size_mm, unit_price)"
      )
      .eq("bracelet_id", id);
    if (error || !data) return [];
    return data as unknown as BraceletBeadRow[];
  } catch {
    return [];
  }
}

async function getCounters(
  id: string
): Promise<{ sold: number; loaned: number }> {
  try {
    const supabase = createSupabaseServerClient();
    const [{ count: sold }, { count: loaned }] = await Promise.all([
      supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("bracelet_id", id),
      supabase
        .from("loans")
        .select("id", { count: "exact", head: true })
        .eq("bracelet_id", id)
        .is("returned_at", null),
    ]);
    return { sold: sold ?? 0, loaned: loaned ?? 0 };
  } catch {
    return { sold: 0, loaned: 0 };
  }
}

async function getSales(id: string): Promise<Sale[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sales")
      .select("id, sale_date, buyer_name, price, is_gift, transaction_id")
      .eq("bracelet_id", id)
      .order("sale_date", { ascending: false });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

async function getLoans(id: string): Promise<Loan[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("loans")
      .select("id, borrower_name, loaned_at, returned_at")
      .eq("bracelet_id", id)
      .order("loaned_at", { ascending: false });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

async function getOpenOrders(id: string): Promise<OpenOrder[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("orders")
      .select("id, customer_name")
      .eq("bracelet_id", id)
      .eq("status", "open")
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export default async function BraceletDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const bracelet = await getBracelet(id);
  if (!bracelet) {
    notFound();
  }

  const [beadRows, counters, sales, loans, openOrders] = await Promise.all([
    getBraceletBeads(id),
    getCounters(id),
    getSales(id),
    getLoans(id),
    getOpenOrders(id),
  ]);

  const materialCost = beadRows.reduce((sum, row) => {
    const price = Number(row.bead?.unit_price ?? 0);
    return sum + price * row.quantity;
  }, 0);

  const inStock = bracelet.made_count - counters.sold - counters.loaned;

  const recordLoanWithId = recordLoan.bind(null, id);
  const recordSaleWithId = recordSale.bind(null, id);
  const deleteBraceletWithId = deleteBracelet.bind(null, id);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-medium text-gray-900">
          {bracelet.name}
        </h1>
        <Link
          href={`/bracelets/${id}/edit`}
          className="shrink-0 text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
        >
          Bearbeiten
        </Link>
      </div>

      <div className="relative mb-6 flex h-56 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {bracelet.photo_url ? (
          <Image
            src={bracelet.photo_url}
            alt={bracelet.name}
            fill
            className="object-cover"
          />
        ) : (
          <span className="text-sm text-gray-400">Kein Bild</span>
        )}
      </div>

      {bracelet.notes && (
        <p className="mb-6 text-sm text-gray-600">{bracelet.notes}</p>
      )}

      <div className="mb-8 grid grid-cols-3 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">
            {Math.max(inStock, 0)}
          </p>
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Auf Lager
          </p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">
            {counters.loaned}
          </p>
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Verliehen
          </p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">
            {counters.sold}
          </p>
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Verkauft
          </p>
        </div>
      </div>

      {error && <p className="mb-6 text-sm text-gray-500">{error}</p>}

      <section className="mb-8">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-400">
          Verwendete Perlen
        </h2>
        {beadRows.length === 0 ? (
          <p className="text-sm text-gray-500">Keine Perlen verknüpft.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {beadRows.map((row) => {
              const price = Number(row.bead?.unit_price ?? 0);
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-gray-900">
                    {row.bead?.article_number ?? "Unbekannte Perle"} ×{" "}
                    {row.quantity}
                  </span>
                  <span className="text-gray-500">
                    {currencyFormatter.format(price * row.quantity)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-right text-sm font-medium text-gray-900">
          Materialkosten gesamt: {currencyFormatter.format(materialCost)}
        </p>
      </section>

      {openOrders.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-400">
            Offene Bestellungen
          </h2>
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {openOrders.map((order) => (
              <li key={order.id} className="px-4 py-3 text-sm text-gray-700">
                {order.customer_name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-400">
          Verkauf erfassen
        </h2>
        <form action={recordSaleWithId} className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              name="buyer_name"
              type="text"
              placeholder="Käufer"
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
              Verkauf speichern
            </button>
          </div>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-400">
          Verleihen
        </h2>
        <form
          action={recordLoanWithId}
          className="flex items-center gap-2"
        >
          <input
            name="borrower_name"
            type="text"
            placeholder="An wen?"
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Verleihen
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-gray-500">{error}</p>}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-400">
          Verleihhistorie
        </h2>
        {loans.length === 0 ? (
          <p className="text-sm text-gray-500">Keine Verleihungen.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {loans.map((loan) => {
              const returnLoanWithIds = returnLoan.bind(null, loan.id, id);
              return (
                <li
                  key={loan.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-gray-700">
                    {formatDate(loan.loaned_at)} · {loan.borrower_name}
                  </span>
                  {loan.returned_at ? (
                    <span className="text-gray-500">
                      zurück am {formatDate(loan.returned_at)}
                    </span>
                  ) : (
                    <form action={returnLoanWithIds}>
                      <button
                        type="submit"
                        className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
                      >
                        Zurückerhalten
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-400">
          Verkaufshistorie
        </h2>
        {sales.length === 0 ? (
          <p className="text-sm text-gray-500">Keine Verkäufe.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {sales.map((sale) => {
              const row = (
                <>
                  <span className="text-gray-700">
                    {formatDate(sale.sale_date)} · {sale.buyer_name}
                    {sale.is_gift ? " (Geschenk)" : ""}
                  </span>
                  <span className="text-gray-500">
                    {currencyFormatter.format(Number(sale.price))}
                  </span>
                </>
              );

              return (
                <li key={sale.id}>
                  {sale.transaction_id ? (
                    <Link
                      href={`/transactions#tx-${sale.transaction_id}`}
                      className="flex items-center justify-between px-4 py-3 text-sm transition hover:bg-gray-50"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      {row}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-4 border-t border-gray-200 pt-4">
        <Link
          href="/bracelets"
          className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
        >
          Zurück
        </Link>
        <ConfirmFormButton
          action={deleteBraceletWithId}
          label="Armband löschen"
          confirmMessage="Dieses Armband wirklich löschen?"
        />
      </div>
    </main>
  );
}
