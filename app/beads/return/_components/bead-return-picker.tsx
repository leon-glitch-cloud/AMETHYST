"use client";

import { useState } from "react";

export type BeadOption = {
  id: string;
  article_number: string;
  color: string | null;
  size_mm: number | string | null;
  unit_price: number | string | null;
};

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function beadLabel(bead: BeadOption): string {
  const details = [bead.color, bead.size_mm != null ? `${bead.size_mm} mm` : null]
    .filter(Boolean)
    .join(" · ");
  return details ? `${bead.article_number} (${details})` : bead.article_number;
}

function suggestedAmount(bead: BeadOption | undefined, quantity: number): number {
  return quantity * Number(bead?.unit_price ?? 0);
}

type Row = {
  key: string;
  beadId: string;
  quantity: number;
  amount: number;
  amountTouched: boolean;
};

export function BeadReturnPicker({ allBeads }: { allBeads: BeadOption[] }) {
  const [rows, setRows] = useState<Row[]>([]);

  const beadsById = new Map(allBeads.map((bead) => [bead.id, bead]));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  function addRow() {
    if (allBeads.length === 0) return;
    const bead = allBeads[0];
    setRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        beadId: bead.id,
        quantity: 1,
        amount: suggestedAmount(bead, 1),
        amountTouched: false,
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function updateBeadOrQuantity(
    key: string,
    patch: Partial<{ beadId: string; quantity: number }>
  ) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (!next.amountTouched) {
          next.amount = suggestedAmount(
            beadsById.get(next.beadId),
            next.quantity
          );
        }
        return next;
      })
    );
  }

  function updateAmount(key: string, amount: number) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, amount, amountTouched: true } : row
      )
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">
        Zurückgesendete Perlen
      </label>

      {allBeads.length === 0 ? (
        <p className="text-sm text-gray-500">
          Noch keine Perlen im Materialbestand angelegt.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="flex-1">Perle</span>
              <span className="w-20">Menge</span>
              <span className="w-24">Erstattung (€)</span>
              <span className="w-16" />
            </div>
          )}
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <select
                name="bead_id"
                value={row.beadId}
                onChange={(event) =>
                  updateBeadOrQuantity(row.key, { beadId: event.target.value })
                }
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              >
                {allBeads.map((bead) => (
                  <option key={bead.id} value={bead.id}>
                    {beadLabel(bead)}
                  </option>
                ))}
              </select>
              <input
                name="quantity"
                type="number"
                min={1}
                step={1}
                value={row.quantity}
                onChange={(event) =>
                  updateBeadOrQuantity(row.key, {
                    quantity: Number(event.target.value) || 1,
                  })
                }
                className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
              <input
                name="refund_amount"
                type="number"
                min={0}
                step={0.01}
                value={row.amount}
                onChange={(event) =>
                  updateAmount(row.key, Number(event.target.value) || 0)
                }
                className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="w-16 text-sm text-gray-500 hover:text-gray-900"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        disabled={allBeads.length === 0}
        className="mt-2 text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
      >
        + Perle hinzufügen
      </button>

      <p className="mt-2 text-sm text-gray-500">
        Erstattung gesamt: {currencyFormatter.format(total)}
      </p>
    </div>
  );
}
