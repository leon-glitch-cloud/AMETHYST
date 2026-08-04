"use client";

import { useRef, useState, useTransition } from "react";
import { suggestBeadsFromPhoto } from "@/app/bracelets/actions";
import {
  BeadPicker,
  type BeadItem,
  type BeadOption,
  type BeadPickerHandle,
} from "@/app/bracelets/_components/bead-picker";

export function BraceletBeadSection({
  allBeads,
  initialItems,
  photoFieldLabelSuffix = "",
}: {
  allBeads: BeadOption[];
  initialItems?: BeadItem[];
  photoFieldLabelSuffix?: string;
}) {
  const pickerRef = useRef<BeadPickerHandle>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [isSuggesting, startSuggesting] = useTransition();

  function handleSuggest() {
    if (!photoFile) {
      setSuggestError("Bitte zuerst ein Foto auswählen.");
      return;
    }

    setSuggestError(null);
    startSuggesting(async () => {
      const formData = new FormData();
      formData.set("photo", photoFile);
      const result = await suggestBeadsFromPhoto(formData);
      if (!result.ok) {
        setSuggestError(result.message);
        return;
      }
      pickerRef.current?.setItems(result.items);
    });
  }

  return (
    <>
      <div>
        <label className="mb-1 block text-sm text-gray-600" htmlFor="photo">
          Foto{photoFieldLabelSuffix}
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={isSuggesting}
          className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
        >
          {isSuggesting
            ? "Analysiere Foto…"
            : "Perlen-Vorschlag von KI generieren"}
        </button>
        <p className="mt-1 text-xs text-gray-400">
          Für beste Ergebnisse sollten Perlen im Materialbestand ein
          Referenzfoto haben.
        </p>
        {suggestError && (
          <p className="mt-1 text-sm text-gray-500">{suggestError}</p>
        )}
      </div>

      <BeadPicker ref={pickerRef} allBeads={allBeads} initialItems={initialItems} />
    </>
  );
}
