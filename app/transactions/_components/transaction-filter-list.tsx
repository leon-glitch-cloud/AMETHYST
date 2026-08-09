"use client";

import { useMemo, useState } from "react";
import { ConfirmFormButton } from "@/app/_components/confirm-form-button";

export type Transaction = {
  id: string;
  date: string;
  type: "expense" | "sale" | "refund";
  description: string;
  amount: number | string;
  counterparty_name: string | null;
  is_gift: boolean;
};

type DisplayType = "expense" | "sale" | "refund" | "gift";

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const DISPLAY_TYPES: DisplayType[] = ["expense", "sale", "refund", "gift"];

const typeLabels: Record<DisplayType, string> = {
  expense: "Ausgabe",
  sale: "Verkauf",
  refund: "Einnahme",
  gift: "Geschenk",
};

function displayType(tx: Transaction): DisplayType {
  return tx.type === "sale" && tx.is_gift ? "gift" : tx.type;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-DE");
}

export function TransactionFilterList({
  transactions,
  deleteTransaction,
}: {
  transactions: Transaction[];
  deleteTransaction: (id: string, formData: FormData) => void | Promise<void>;
}) {
  const [types, setTypes] = useState<Set<DisplayType>>(
    new Set(DISPLAY_TYPES)
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function toggleType(type: DisplayType) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (!types.has(displayType(tx))) return false;
      if (from && tx.date < from) return false;
      if (to && tx.date > to) return false;
      return true;
    });
  }, [transactions, types, from, to]);

  const income = filtered.reduce(
    (sum, tx) => (Number(tx.amount) > 0 ? sum + Number(tx.amount) : sum),
    0
  );
  const expense = filtered.reduce(
    (sum, tx) => (Number(tx.amount) < 0 ? sum + Number(tx.amount) : sum),
    0
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        {DISPLAY_TYPES.map((type) => (
          <label
            key={type}
            className="flex items-center gap-1.5 text-gray-600"
          >
            <input
              type="checkbox"
              checked={types.has(type)}
              onChange={() => toggleType(type)}
            />
            {typeLabels[type]}
          </label>
        ))}

        <span className="ml-auto flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-gray-900 outline-none focus:border-gray-500"
          />
          <span className="text-gray-400">–</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-gray-900 outline-none focus:border-gray-500"
          />
        </span>
      </div>

      <div className="mb-4 flex items-center justify-end gap-6 text-sm text-gray-500">
        <span>Einnahmen: {currencyFormatter.format(income)}</span>
        <span>Ausgaben: {currencyFormatter.format(expense)}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Keine Buchungen gefunden.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {filtered.map((tx) => (
            <li
              key={tx.id}
              id={`tx-${tx.id}`}
              className="flex scroll-mt-4 items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-gray-900">
                  {tx.description}
                  {tx.counterparty_name ? ` · ${tx.counterparty_name}` : ""}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(tx.date)} · {typeLabels[displayType(tx)]}
                </p>
              </div>
              <span className="shrink-0 text-gray-900">
                {currencyFormatter.format(Number(tx.amount))}
              </span>
              <ConfirmFormButton
                action={deleteTransaction.bind(null, tx.id)}
                label="Löschen"
                confirmMessage={
                  tx.type === "sale"
                    ? `Diese Buchung wirklich löschen? Der zugehörige ${
                        tx.is_gift ? "Geschenk-Eintrag" : "Verkauf"
                      } bleibt in der Verkaufshistorie des Armbands bestehen, zählt dann aber nicht mehr zum Saldo.`
                    : "Diese Buchung wirklich löschen?"
                }
                className="shrink-0 text-sm text-gray-400 hover:text-gray-900"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
