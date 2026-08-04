"use client";

import { useState } from "react";

export type MaterialOrderItem = {
  article_number: string;
  color: string | null;
  size_mm: number | null;
  unit_price: number | null;
  shop: string | null;
  quantity: number;
};

type Row = {
  key: string;
  articleNumber: string;
  color: string;
  sizeMm: string;
  unitPrice: string;
  shop: string;
  quantity: string;
};

function itemToRow(item: MaterialOrderItem): Row {
  return {
    key: crypto.randomUUID(),
    articleNumber: item.article_number,
    color: item.color ?? "",
    sizeMm: item.size_mm != null ? String(item.size_mm) : "",
    unitPrice: item.unit_price != null ? String(item.unit_price) : "",
    shop: item.shop ?? "",
    quantity: String(item.quantity),
  };
}

export function MaterialOrderItemsEditor({
  initialItems = [],
}: {
  initialItems?: MaterialOrderItem[];
}) {
  const [rows, setRows] = useState<Row[]>(() => initialItems.map(itemToRow));

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        articleNumber: "",
        color: "",
        sizeMm: "",
        unitPrice: "",
        shop: "",
        quantity: "1",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          Keine Positionen erkannt. Füge sie manuell hinzu.
        </p>
      ) : (
        rows.map((row) => (
          <div
            key={row.key}
            className="rounded-md border border-gray-200 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <input
                name="article_number"
                type="text"
                placeholder="Artikelnummer"
                value={row.articleNumber}
                onChange={(event) =>
                  updateRow(row.key, { articleNumber: event.target.value })
                }
                required
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Entfernen
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <input
                name="color"
                type="text"
                placeholder="Farbe"
                value={row.color}
                onChange={(event) =>
                  updateRow(row.key, { color: event.target.value })
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
              <input
                name="size_mm"
                type="number"
                step="0.1"
                placeholder="Größe (mm)"
                value={row.sizeMm}
                onChange={(event) =>
                  updateRow(row.key, { sizeMm: event.target.value })
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
              <input
                name="unit_price"
                type="number"
                step="0.01"
                placeholder="Preis (€)"
                value={row.unitPrice}
                onChange={(event) =>
                  updateRow(row.key, { unitPrice: event.target.value })
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
              <input
                name="source_shop"
                type="text"
                placeholder="Shop"
                value={row.shop}
                onChange={(event) =>
                  updateRow(row.key, { shop: event.target.value })
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
              <input
                name="quantity"
                type="number"
                step="1"
                min={1}
                placeholder="Menge"
                value={row.quantity}
                onChange={(event) =>
                  updateRow(row.key, { quantity: event.target.value })
                }
                required
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
            </div>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={addRow}
        className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
      >
        + Position hinzufügen
      </button>
    </div>
  );
}
