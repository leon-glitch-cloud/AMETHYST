"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { BeadOption } from "@/app/bracelets/_components/bead-picker";

function matchesQuery(bead: BeadOption, query: string): boolean {
  if (!query) return true;
  const haystack = [bead.article_number, bead.name, bead.color]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function BeadPickerModal({
  allBeads,
  onSelect,
  onClose,
}: {
  allBeads: BeadOption[];
  onSelect: (beadId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filteredBeads = useMemo(
    () => allBeads.filter((bead) => matchesQuery(bead, query)),
    [allBeads, query]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-4">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Suche nach Name, Artikelnummer oder Farbe…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="shrink-0 text-sm text-gray-500 hover:text-gray-900"
          >
            Abbrechen
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {filteredBeads.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Keine Perlen gefunden.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredBeads.map((bead) => (
                <button
                  key={bead.id}
                  type="button"
                  onClick={() => onSelect(bead.id)}
                  className="flex flex-col items-center gap-1.5 rounded-md border border-gray-200 p-2 text-center transition hover:border-gray-400 hover:bg-gray-50"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    {bead.image_url ? (
                      <Image
                        src={bead.image_url}
                        alt={bead.article_number}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                        Kein Bild
                      </span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-xs font-medium text-gray-900">
                    {bead.name || bead.article_number}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {[bead.color, bead.size_mm != null ? `${bead.size_mm} mm` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
