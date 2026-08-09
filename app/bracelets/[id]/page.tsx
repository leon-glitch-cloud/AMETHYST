import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  recordLoan,
  returnLoan,
  recordSale,
  deleteBracelet,
  addBraceletSizeVariant,
} from "@/app/bracelets/actions";
import { ConfirmFormButton } from "@/app/_components/confirm-form-button";
import { BackLink } from "@/app/_components/back-link";
import { SubmitButton } from "@/app/_components/submit-button";

const BRACELET_SIZES = ["S", "M", "L"] as const;

type Bracelet = {
  id: string;
  name: string;
  photo_url: string | null;
  made_count: number;
  notes: string | null;
  size: string | null;
  variant_group_id: string | null;
};

type SizeVariant = { id: string; size: string | null };

type BraceletBeadRow = {
  id: string;
  quantity: number;
  unknown_description: string | null;
  bead: {
    id: string;
    article_number: string;
    name: string | null;
    image_url: string | null;
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
      .select("id, name, photo_url, made_count, notes, size, variant_group_id")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function getSizeVariants(variantGroupId: string): Promise<SizeVariant[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bracelets")
      .select("id, size")
      .eq("variant_group_id", variantGroupId);
    if (error || !data) return [];
    return data.sort(
      (a, b) =>
        BRACELET_SIZES.indexOf((a.size ?? "") as (typeof BRACELET_SIZES)[number]) -
        BRACELET_SIZES.indexOf((b.size ?? "") as (typeof BRACELET_SIZES)[number])
    );
  } catch {
    return [];
  }
}

async function getBraceletBeads(id: string): Promise<BraceletBeadRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bracelet_beads")
      .select(
        "id, quantity, unknown_description, bead:beads(id, article_number, name, image_url, color, size_mm, unit_price)"
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

  const [beadRows, counters, sales, loans, openOrders, sizeVariants] =
    await Promise.all([
      getBraceletBeads(id),
      getCounters(id),
      getSales(id),
      getLoans(id),
      getOpenOrders(id),
      bracelet.variant_group_id
        ? getSizeVariants(bracelet.variant_group_id)
        : Promise.resolve<SizeVariant[]>([]),
    ]);

  const availableNewSizes = BRACELET_SIZES.filter(
    (size) => !sizeVariants.some((variant) => variant.size === size)
  );

  const materialCost = beadRows.reduce((sum, row) => {
    const price = Number(row.bead?.unit_price ?? 0);
    return sum + price * row.quantity;
  }, 0);

  const inStock = bracelet.made_count - counters.sold - counters.loaned;

  const recordLoanWithId = recordLoan.bind(null, id);
  const recordSaleWithId = recordSale.bind(null, id);
  const deleteBraceletWithId = deleteBracelet.bind(null, id);
  const addSizeVariantWithId = addBraceletSizeVariant.bind(null, id);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <BackLink href="/bracelets" />

      {sizeVariants.length > 1 && (
        <div className="mb-4 flex gap-2">
          {sizeVariants.map((variant) => (
            <Link
              key={variant.id}
              href={`/bracelets/${variant.id}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                variant.id === id
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {variant.size ?? "?"}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-medium text-gray-900">
          {bracelet.name}
          {bracelet.size && (
            <span className="ml-2 text-base font-normal text-gray-400">
              ({bracelet.size})
            </span>
          )}
        </h1>
        <Link
          href={`/bracelets/${id}/edit`}
          className="shrink-0 text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
        >
          Bearbeiten
        </Link>
      </div>

      {bracelet.photo_url ? (
        <div className="relative mb-6 overflow-hidden rounded-lg bg-gray-100">
          <Image
            src={bracelet.photo_url}
            alt={bracelet.name}
            width={1200}
            height={1200}
            sizes="(min-width: 672px) 640px, 100vw"
            className="h-auto w-full"
          />
        </div>
      ) : (
        <div className="mb-6 flex h-56 items-center justify-center rounded-lg bg-gray-100">
          <span className="text-sm text-gray-400">Kein Bild</span>
        </div>
      )}

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

      {availableNewSizes.length > 0 && (
        <details className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            + Größe hinzufügen
          </summary>
          <form
            action={addSizeVariantWithId}
            className="mt-3 flex flex-wrap items-end gap-2"
          >
            {!bracelet.size && (
              <div>
                <label
                  className="mb-1 block text-sm text-gray-600"
                  htmlFor="current_size"
                >
                  Größe dieses Armbands
                </label>
                <select
                  id="current_size"
                  name="current_size"
                  required
                  defaultValue=""
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
                >
                  <option value="" disabled>
                    Wählen…
                  </option>
                  {BRACELET_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label
                className="mb-1 block text-sm text-gray-600"
                htmlFor="new_size"
              >
                Neue Größe
              </label>
              <select
                id="new_size"
                name="new_size"
                required
                defaultValue=""
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              >
                <option value="" disabled>
                  Wählen…
                </option>
                {availableNewSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton pendingLabel="Legt an…">Hinzufügen</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-gray-400">
            Übernimmt Foto und Perlenliste als Ausgangspunkt — danach kannst
            du die neue Größe separat anpassen.
          </p>
        </details>
      )}

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
              const rowContent = (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    {row.bead && (
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100">
                        {row.bead.image_url ? (
                          <Image
                            src={row.bead.image_url}
                            alt={row.bead.article_number}
                            fill
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                    )}
                    <span
                      className={`truncate ${row.bead ? "text-gray-900" : "text-amber-600"}`}
                    >
                      {row.bead
                        ? [row.bead.name, row.bead.article_number]
                            .filter(Boolean)
                            .join(" · ")
                        : `Unbekannte Perle${
                            row.unknown_description
                              ? ` (${row.unknown_description})`
                              : ""
                          }`}{" "}
                      × {row.quantity}
                    </span>
                  </div>
                  <span className="shrink-0 text-gray-500">
                    {currencyFormatter.format(price * row.quantity)}
                  </span>
                </>
              );

              return (
                <li key={row.id}>
                  {row.bead ? (
                    <Link
                      href={`/beads/${row.bead.id}?from=${encodeURIComponent(`/bracelets/${id}`)}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition hover:bg-gray-50"
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      {rowContent}
                    </div>
                  )}
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
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="block px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  {order.customer_name}
                </Link>
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
            <SubmitButton pendingLabel="Speichert…">
              Verkauf speichern
            </SubmitButton>
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
          <SubmitButton pendingLabel="Speichert…">Verleihen</SubmitButton>
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
                      <SubmitButton
                        pendingLabel="Speichert…"
                        className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
                      >
                        Zurückerhalten
                      </SubmitButton>
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
