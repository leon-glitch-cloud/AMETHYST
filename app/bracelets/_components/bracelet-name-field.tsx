"use client";

import { useRef, useState, useTransition } from "react";
import { suggestBraceletNameFromPhoto } from "@/app/bracelets/actions";
import { AmethystSpinner } from "@/app/_components/amethyst-spinner";

export function BraceletNameField({
  defaultValue,
  photoFile,
}: {
  defaultValue?: string;
  photoFile: File | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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
      const result = await suggestBraceletNameFromPhoto(formData);
      if (!result.ok) {
        setSuggestError(result.message);
        return;
      }
      if (inputRef.current) {
        inputRef.current.value = result.name;
      }
    });
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600" htmlFor="name">
        Name
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultValue}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
        />
        <button
          type="button"
          onClick={handleSuggest}
          disabled={isSuggesting || !photoFile}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSuggesting && <AmethystSpinner size={14} />}
          {isSuggesting ? "…" : "Von KI vorschlagen"}
        </button>
      </div>
      {suggestError && (
        <p className="mt-1 text-sm text-gray-500">{suggestError}</p>
      )}
    </div>
  );
}
