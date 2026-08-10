"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import Image from "next/image";
import { BeadPickerModal } from "@/app/bracelets/_components/bead-picker-modal";

export type BeadOption = {
  id: string;
  article_number: string;
  name: string | null;
  image_url: string | null;
  color: string | null;
  size_mm: number | string | null;
  unit_price: number | string | null;
};

export type BeadItem = {
  bead_id: string | null;
  quantity: number;
  unknown_description?: string | null;
};

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function beadLabel(bead: BeadOption): string {
  const idPart = [bead.article_number, bead.name].filter(Boolean).join(" · ");
  const details = [bead.color, bead.size_mm != null ? `${bead.size_mm} mm` : null]
    .filter(Boolean)
    .join(" · ");
  return details ? `${idPart} (${details})` : idPart;
}

export type BeadPickerHandle = {
  setItems: (items: BeadItem[]) => void;
};

export const BeadPicker = forwardRef<BeadPickerHandle, {
  allBeads: BeadOption[];
  initialItems?: BeadItem[];
}>(function BeadPicker({ allBeads, initialItems = [] }, ref) {
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const [rows, setRows] = useState<
    {
      key: string;
      beadId: string;
      quantity: number;
      unknownDescription: string | null;
    }[]
  >(() =>
    initialItems.map((item) => ({
      key: crypto.randomUUID(),
      beadId: item.bead_id ?? "",
      quantity: item.quantity,
      unknownDescription: item.unknown_description ?? null,
    }))
  );

  useImperativeHandle(ref, () => ({
    setItems(items: BeadItem[]) {
      setRows(
        items.map((item) => ({
          key: crypto.randomUUID(),
          beadId: item.bead_id ?? "",
          quantity: item.quantity,
          unknownDescription: item.unknown_description ?? null,
        }))
      );
    },
  }));

  const beadsById = new Map(allBeads.map((bead) => [bead.id, bead]));

  const total = rows.reduce((sum, row) => {
    const bead = beadsById.get(row.beadId);
    if (!bead) return sum;
    return sum + row.quantity * Number(bead.unit_price ?? 0);
  }, 0);

  const unresolvedCount = rows.filter((row) => !row.beadId).length;

  function addRow() {
    if (allBeads.length === 0) return;
    setRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        beadId: allBeads[0].id,
        quantity: 1,
        unknownDescription: null,
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function updateRow(
    key: string,
    patch: Partial<{
      beadId: string;
      quantity: number;
      unknownDescription: string | null;
    }>
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
          {rows.map((row) => {
            const selectedBead = beadsById.get(row.beadId);
            return (
            <div key={row.key} className="flex items-center gap-2">
              <input type="hidden" name="bead_id" value={row.beadId} />
              <input
                type="hidden"
                name="unknown_description"
                value={row.unknownDescription ?? ""}
              />
              <button
                type="button"
                onClick={() => setOpenRowKey(row.key)}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm outline-none transition hover:bg-gray-50 ${
                  row.beadId
                    ? "border-gray-300 text-gray-900"
                    : "border-amber-300 text-amber-700"
                }`}
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  {selectedBead?.image_url ? (
                    <Image
                      src={selectedBead.image_url}
                      alt={selectedBead.article_number}
                      fill
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <span className="min-w-0 truncate">
                  {selectedBead
                    ? beadLabel(selectedBead)
                    : row.unknownDescription
                      ? `Unbekannt: ${row.unknownDescription}`
                      : "— Perle wählen —"}
                </span>
              </button>
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
            );
          })}
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

      {unresolvedCount > 0 && (
        <p className="mt-2 text-sm text-amber-600">
          {unresolvedCount} unbekannte Perle
          {unresolvedCount === 1 ? "" : "n"} noch nicht zugeordnet — bitte
          auswählen, sobald sie im Materialbestand erfasst ist.
        </p>
      )}

      <p className="mt-2 text-sm text-gray-500">
        Materialkosten: {currencyFormatter.format(total)}
      </p>

      {openRowKey && (
        <BeadPickerModal
          allBeads={allBeads}
          onClose={() => setOpenRowKey(null)}
          onSelect={(beadId) => {
            updateRow(openRowKey, { beadId, unknownDescription: null });
            setOpenRowKey(null);
          }}
        />
      )}
    </div>
  );
});
