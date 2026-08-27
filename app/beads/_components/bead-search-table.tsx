"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type Bead = {
  id: string;
  article_number: string;
  name: string | null;
  material: string | null;
  image_url: string | null;
  size_mm: number | string | null;
  color: string | null;
  unit_price: number | string | null;
  source_shop: string | null;
};

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 4,
});

export function BeadSearchTable({ beads }: { beads: Bead[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return beads;
    return beads.filter((bead) => {
      const size = bead.size_mm != null ? String(bead.size_mm) : "";
      return (
        bead.article_number.toLowerCase().includes(q) ||
        (bead.name ?? "").toLowerCase().includes(q) ||
        (bead.material ?? "").toLowerCase().includes(q) ||
        (bead.color ?? "").toLowerCase().includes(q) ||
        (bead.source_shop ?? "").toLowerCase().includes(q) ||
        size.includes(q)
      );
    });
  }, [beads, query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Suche nach Nummer, Name, Material, Farbe, Größe, Shop…"
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Keine Perlen gefunden.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {filtered.map((bead) => (
            <li key={bead.id}>
              <Link
                href={`/beads/${bead.id}`}
                className="flex items-center gap-4 px-4 py-3 transition hover:bg-gray-50"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100">
                  {bead.image_url ? (
                    <Image
                      src={bead.image_url}
                      alt={bead.article_number}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-center text-[10px] leading-tight text-gray-400">
                      Kein Bild
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {bead.article_number}
                    {bead.name ? ` · ${bead.name}` : ""}
                  </p>
                  <p className="truncate text-sm text-gray-500">
                    {[
                      bead.material,
                      bead.color,
                      bead.size_mm != null ? `${bead.size_mm} mm` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm text-gray-900">
                    {currencyFormatter.format(Number(bead.unit_price ?? 0))}
                  </p>
                  <p className="text-sm text-gray-500">pro Perle</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
