"use client";

import { useState } from "react";

export type BeadOption = {
  id: string;
  article_number: string;
  color: string | null;
  size_mm: number | string | null;
  unit_price: number | string | null;
};

export type BeadItem = { bead_id: string; quantity: number };

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

export function BeadPicker({
  allBeads,
  initialItems = [],
}: {
  allBeads: BeadOption[];
  initialItems?: BeadItem[];
}) {
  const [rows, setRows] = useState<
    { key: string; beadId: string; quantity: number }[]
  >(() =>
    initialItems.map((item) => ({
      key: crypto.randomUUID(),
      beadId: item.bead_id,
      quantity: item.quantity,
    }))
  );

  const beadsById = new Map(allBeads.map((bead) => [bead.id, bead]));

  const total = rows.reduce((sum, row) => {
    const bead = beadsById.get(row.beadId);
    if (!bead) return sum;
    return sum + row.quantity * Number(bead.unit_price ?? 0);
  }, 0);

  function addRow() {
    if (allBeads.length === 0) return;
    setRows((prev) => [
      ...prev,
      { key: crypto.randomUUID(), beadId: allBeads[0].id, quantity: 1 },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function updateRow(
    key: string,
    patch: Partial<{ beadId: string; quantity: number }>
  ) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">
        Verwendete Perlen
      </label>

      {allBeads.length === 0 ? (
        <p className="text-sm text-gray-500">
          Noch keine Perlen im Materialbestand angelegt.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <select
                name="bead_id"
                value={row.beadId}
                onChange={(event) =>
                  updateRow(row.key, { beadId: event.target.value })
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
                  updateRow(row.key, {
                    quantity: Number(event.target.value) || 1,
                  })
                }
                className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="text-sm text-gray-500 hover:text-gray-900"
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
        Materialkosten: {currencyFormatter.format(total)}
      </p>
    </div>
  );
}
