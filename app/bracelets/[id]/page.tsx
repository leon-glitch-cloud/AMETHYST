import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  recordBraceletEvent,
  increaseMadeCount,
  decreaseMadeCount,
  returnLoan,
  deleteSale,
  deleteBracelet,
  addBraceletSizeVariant,
} from "@/app/bracelets/actions";
import { ConfirmFormButton } from "@/app/_components/confirm-form-button";
import { BackLink } from "@/app/_components/back-link";
import { SubmitButton } from "@/app/_components/submit-button";
import { BraceletEventForm } from "@/app/bracelets/_components/bracelet-event-form";

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

type SizeVariant = { id: string; size: string | null; made_count: number };

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
  bracelet_id: string;
};

type Loan = {
  id: string;
  borrower_name: string;
  loaned_at: string;
  returned_at: string | null;
  bracelet_id: string;
};

type OpenOrder = {
  id: string;
  customer_name: string;
};

type HistoryEntry = {
  id: string;
  date: string;
  type: "sold" | "gift" | "loaned";
  personName: string;
  price: number | string | null;
  transactionId: string | null;
  saleId: string | null;
  loanId: string | null;
  returnedAt: string | null;
  size: string | null;
};

const historyTypeLabels: Record<HistoryEntry["type"], string> = {
  sold: "Verkauft",
  gift: "Geschenk",
  loaned: "Verliehen",
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
      .select("id, size, made_count")
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
  ids: string[]
): Promise<{ sold: number; gifted: number; loaned: number }> {
  try {
    const supabase = createSupabaseServerClient();
    const [{ data: salesRows }, { count: loaned }] = await Promise.all([
      supabase.from("sales").select("is_gift").in("bracelet_id", ids),
      supabase
        .from("loans")
        .select("id", { count: "exact", head: true })
        .in("bracelet_id", ids)
        .is("returned_at", null),
    ]);
    const sold = (salesRows ?? []).filter((row) => !row.is_gift).length;
    const gifted = (salesRows ?? []).filter((row) => row.is_gift).length;
    return { sold, gifted, loaned: loaned ?? 0 };
  } catch {
    return { sold: 0, gifted: 0, loaned: 0 };
  }
}

async function getSales(ids: string[]): Promise<Sale[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sales")
      .select("id, sale_date, buyer_name, price, is_gift, transaction_id, bracelet_id")
      .in("bracelet_id", ids)
      .order("sale_date", { ascending: false });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

async function getLoans(ids: string[]): Promise<Loan[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("loans")
      .select("id, borrower_name, loaned_at, returned_at, bracelet_id")
      .in("bracelet_id", ids)
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
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { id } = await params;
  const { error, from } = await searchParams;

  // Nur interne Pfade zulassen (kein "//evil.com"-Open-Redirect-Trick).
  const backHref =
    from && from.startsWith("/") && !from.startsWith("//") ? from : "/bracelets";

  const bracelet = await getBracelet(id);
  if (!bracelet) {
    notFound();
  }

  const sizeVariants = bracelet.variant_group_id
    ? await getSizeVariants(bracelet.variant_group_id)
    : [];

  const variantIds = sizeVariants.length > 0 ? sizeVariants.map((v) => v.id) : [id];
  const sizeById = new Map(sizeVariants.map((v) => [v.id, v.size]));

  const [beadRows, counters, sales, loans, openOrders] = await Promise.all([
    getBraceletBeads(id),
    getCounters(variantIds),
    getSales(variantIds),
    getLoans(variantIds),
    getOpenOrders(id),
  ]);

  const availableNewSizes = BRACELET_SIZES.filter(
    (size) => !sizeVariants.some((variant) => variant.size === size)
  );

  const materialCost = beadRows.reduce((sum, row) => {
    const price = Number(row.bead?.unit_price ?? 0);
    return sum + price * row.quantity;
  }, 0);

  const totalMadeCount =
    sizeVariants.length > 0
      ? sizeVariants.reduce((sum, variant) => sum + variant.made_count, 0)
      : bracelet.made_count;

  const inStock =
    totalMadeCount - counters.sold - counters.gifted - counters.loaned;

  const usedByVariant = new Map<string, number>();
  sales.forEach((sale) => {
    usedByVariant.set(sale.bracelet_id, (usedByVariant.get(sale.bracelet_id) ?? 0) + 1);
  });
  loans.forEach((loan) => {
    if (!loan.returned_at) {
      usedByVariant.set(loan.bracelet_id, (usedByVariant.get(loan.bracelet_id) ?? 0) + 1);
    }
  });
  const stockByVariant = sizeVariants.map((variant) => ({
    id: variant.id,
    size: variant.size,
    inStock: variant.made_count - (usedByVariant.get(variant.id) ?? 0),
  }));

  const historyEntries: HistoryEntry[] = [
    ...sales.map((sale) => ({
      id: `sale-${sale.id}`,
      date: sale.sale_date,
      type: (sale.is_gift ? "gift" : "sold") as HistoryEntry["type"],
      personName: sale.buyer_name,
      price: sale.price,
      transactionId: sale.transaction_id,
      saleId: sale.id,
      loanId: null,
      returnedAt: null,
      size: sizeById.get(sale.bracelet_id) ?? null,
    })),
    ...loans.map((loan) => ({
      id: `loan-${loan.id}`,
      date: loan.loaned_at,
      type: "loaned" as HistoryEntry["type"],
      personName: loan.borrower_name,
      price: null,
      transactionId: null,
      saleId: null,
      loanId: loan.id,
      returnedAt: loan.returned_at,
      size: sizeById.get(loan.bracelet_id) ?? null,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const recordEventWithId = recordBraceletEvent.bind(null, id);
  const increaseMadeCountWithId = increaseMadeCount.bind(null, id);
  const decreaseMadeCountWithId = decreaseMadeCount.bind(null, id);
  const deleteBraceletWithId = deleteBracelet.bind(null, id);
  const addSizeVariantWithId = addBraceletSizeVariant.bind(null, id);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <BackLink href={backHref} />

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

      <div className="mb-8 grid grid-cols-4 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-center">
        <div>
          {stockByVariant.length > 1 ? (
            <div className="space-y-0.5">
              {stockByVariant.map((variant) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-center gap-1.5"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {Math.max(variant.inStock, 0)}× {variant.size ?? "?"}
                  </span>
                  <form action={decreaseMadeCount.bind(null, variant.id)}>
                    <SubmitButton className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] leading-none text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70">
                      −
                    </SubmitButton>
                  </form>
                  <form action={increaseMadeCount.bind(null, variant.id)}>
                    <SubmitButton className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] leading-none text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70">
                      +
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-lg font-semibold text-gray-900">
                {Math.max(inStock, 0)}
              </p>
              <form action={decreaseMadeCountWithId}>
                <SubmitButton className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs leading-none text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70">
                  −
                </SubmitButton>
              </form>
              <form action={increaseMadeCountWithId}>
                <SubmitButton className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs leading-none text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70">
                  +
                </SubmitButton>
              </form>
            </div>
          )}
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
        <div>
          <p className="text-lg font-semibold text-gray-900">
            {counters.gifted}
          </p>
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Verschenkt
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
          Bewegung erfassen
        </h2>
        <BraceletEventForm
          action={recordEventWithId}
          sizeOptions={sizeVariants}
          currentId={id}
        />
        {error && <p className="mt-2 text-sm text-gray-500">{error}</p>}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-400">
          Historie
        </h2>
        {historyEntries.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Bewegungen.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {historyEntries.map((entry) => {
              const info = (
                <>
                  <span className="text-gray-700">
                    {formatDate(entry.date)} · {entry.personName}{" "}
                    <span className="text-xs text-gray-400">
                      ({historyTypeLabels[entry.type]}
                      {entry.size && sizeVariants.length > 1
                        ? ` · ${entry.size}`
                        : ""}
                      )
                    </span>
                  </span>
                  <span className="text-gray-500">
                    {entry.type === "loaned"
                      ? entry.returnedAt
                        ? `zurück am ${formatDate(entry.returnedAt)}`
                        : "offen"
                      : currencyFormatter.format(Number(entry.price))}
                  </span>
                </>
              );

              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                >
                  {entry.transactionId ? (
                    <Link
                      href={`/transactions#tx-${entry.transactionId}`}
                      className="flex flex-1 items-center justify-between gap-4 transition hover:text-gray-600"
                    >
                      {info}
                    </Link>
                  ) : (
                    <div className="flex flex-1 items-center justify-between gap-4">
                      {info}
                    </div>
                  )}
                  {entry.type === "loaned" ? (
                    !entry.returnedAt && (
                      <form action={returnLoan.bind(null, entry.loanId!, id)}>
                        <SubmitButton
                          pendingLabel="Speichert…"
                          className="shrink-0 text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
                        >
                          Zurückerhalten
                        </SubmitButton>
                      </form>
                    )
                  ) : (
                    <ConfirmFormButton
                      action={deleteSale.bind(null, entry.saleId!, id)}
                      label="Löschen"
                      confirmMessage="Diesen Eintrag wirklich löschen? Die zugehörige Buchung im Verlauf wird ebenfalls entfernt."
                      className="shrink-0 text-sm text-gray-400 hover:text-gray-900"
                    />
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
