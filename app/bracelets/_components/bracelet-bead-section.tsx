"use client";

import { useRef, useState, useTransition } from "react";
import { suggestBeadsFromPhoto } from "@/app/bracelets/actions";
import { FileUploadField } from "@/app/_components/file-upload-field";
import { AmethystSpinner } from "@/app/_components/amethyst-spinner";
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
      <FileUploadField
        id="photo"
        name="photo"
        label={`Foto${photoFieldLabelSuffix}`}
        buttonLabel={photoFieldLabelSuffix ? "Foto ersetzen" : "Foto hinzufügen"}
        accept="image/*"
        onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
      />

      <div>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={isSuggesting}
          className="inline-flex items-center gap-2 text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
        >
          {isSuggesting && <AmethystSpinner size={14} />}
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
