"use client";

import { useState } from "react";
import Image from "next/image";
import { productSearchUrl } from "@/lib/beads";
import { ProductSearchButton } from "@/app/_components/product-search-button";

export type MaterialOrderItem = {
  article_number: string;
  name: string | null;
  material: string | null;
  color: string | null;
  size_mm: number | null;
  package_price: number | null;
  shop: string | null;
  package_quantity: number;
  image_url: string | null;
};

type Row = {
  key: string;
  articleNumber: string;
  name: string;
  material: string;
  color: string;
  sizeMm: string;
  packagePrice: string;
  shop: string;
  packageQuantity: string;
  imageUrl: string;
};

function itemToRow(item: MaterialOrderItem): Row {
  return {
    key: crypto.randomUUID(),
    articleNumber: item.article_number,
    name: item.name ?? "",
    material: item.material ?? "",
    color: item.color ?? "",
    sizeMm: item.size_mm != null ? String(item.size_mm) : "",
    packagePrice: item.package_price != null ? String(item.package_price) : "",
    shop: item.shop ?? "",
    packageQuantity: String(item.package_quantity),
    imageUrl: item.image_url ?? "",
  };
}

function LabeledInput({
  id,
  label,
  name,
  type = "text",
  step,
  min,
  required,
  value,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  type?: string;
  step?: string;
  min?: number;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        step={step}
        min={min}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
      />
    </div>
  );
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
        name: "",
        material: "",
        color: "",
        sizeMm: "",
        packagePrice: "",
        shop: "",
        packageQuantity: "1",
        imageUrl: "",
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
              {row.imageUrl && (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  <Image
                    src={row.imageUrl}
                    alt={row.articleNumber || "Erkanntes Foto"}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <input type="hidden" name="image_url" value={row.imageUrl} />
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Entfernen
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <LabeledInput
                id={`${row.key}-name`}
                label="Name"
                name="name"
                value={row.name}
                onChange={(value) => updateRow(row.key, { name: value })}
              />
              <LabeledInput
                id={`${row.key}-article-number`}
                label="Artikelnummer"
                name="article_number"
                required
                value={row.articleNumber}
                onChange={(value) =>
                  updateRow(row.key, { articleNumber: value })
                }
              />
              <LabeledInput
                id={`${row.key}-material`}
                label="Material"
                name="material"
                value={row.material}
                onChange={(value) => updateRow(row.key, { material: value })}
              />
              <LabeledInput
                id={`${row.key}-color`}
                label="Farbe"
                name="color"
                value={row.color}
                onChange={(value) => updateRow(row.key, { color: value })}
              />
              <LabeledInput
                id={`${row.key}-size`}
                label="Größe (mm)"
                name="size_mm"
                type="number"
                step="0.1"
                value={row.sizeMm}
                onChange={(value) => updateRow(row.key, { sizeMm: value })}
              />
              <LabeledInput
                id={`${row.key}-price`}
                label="Packungspreis (€)"
                name="package_price"
                type="number"
                step="0.01"
                value={row.packagePrice}
                onChange={(value) =>
                  updateRow(row.key, { packagePrice: value })
                }
              />
              <LabeledInput
                id={`${row.key}-quantity`}
                label="Packungsmenge (Stk.)"
                name="package_quantity"
                type="number"
                step="1"
                min={1}
                required
                value={row.packageQuantity}
                onChange={(value) =>
                  updateRow(row.key, { packageQuantity: value })
                }
              />
              <LabeledInput
                id={`${row.key}-shop`}
                label="Shop"
                name="source_shop"
                value={row.shop}
                onChange={(value) => updateRow(row.key, { shop: value })}
              />
            </div>
            {row.articleNumber.trim() && (
              <div className="mt-2">
                <ProductSearchButton
                  url={productSearchUrl(
                    row.articleNumber.trim(),
                    row.shop.trim() || null
                  )}
                  shop={row.shop.trim() || null}
                />
              </div>
            )}
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
