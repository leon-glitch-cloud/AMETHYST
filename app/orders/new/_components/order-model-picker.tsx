"use client";

import { useState } from "react";
import type { BraceletModelOption } from "@/lib/bracelet-models";

const BRACELET_SIZES = ["S", "M", "L"] as const;
export const NEW_MODEL_KEY = "__new__";

export function OrderModelPicker({
  models,
  initialModelKey = "",
  initialSize = "",
  initialNewModelName = "",
  initialWishText = "",
}: {
  models: BraceletModelOption[];
  initialModelKey?: string;
  initialSize?: string;
  initialNewModelName?: string;
  initialWishText?: string;
}) {
  const [selectedKey, setSelectedKey] = useState(initialModelKey);
  const [selectedSize, setSelectedSize] = useState(initialSize);
  const [newModelName, setNewModelName] = useState(initialNewModelName);
  const selectedModel = models.find((model) => model.key === selectedKey) ?? null;
  const isNewModel = selectedKey === NEW_MODEL_KEY;
  const matchedVariant = selectedModel
    ? (selectedModel.sizes.find((option) => option.size === selectedSize) ?? null)
    : null;

  return (
    <div className="space-y-4">
      <div>
        <label
          className="mb-1 block text-sm text-gray-600"
          htmlFor="bracelet_model"
        >
          Armband-Modell
        </label>
        <select
          id="bracelet_model"
          value={selectedKey}
          onChange={(event) => {
            setSelectedKey(event.target.value);
            setSelectedSize("");
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
        >
          <option value="">— kein Modell —</option>
          <option value={NEW_MODEL_KEY}>
            + Neues Modell (noch nicht im Armbandbestand erfasst)
          </option>
          {models.map((model) => (
            <option key={model.key} value={model.key}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {isNewModel && (
        <div>
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="new_model_name"
          >
            Modellname
          </label>
          <input
            id="new_model_name"
            type="text"
            required
            value={newModelName}
            onChange={(event) => setNewModelName(event.target.value)}
            placeholder="z. B. Blaue Welle"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>
      )}

      {(selectedModel || isNewModel) && (
        <div>
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="bracelet_size"
          >
            Größe
          </label>
          <select
            id="bracelet_size"
            required
            value={selectedSize}
            onChange={(event) => setSelectedSize(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          >
            <option value="" disabled>
              Wählen…
            </option>
            {BRACELET_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          {selectedModel && selectedSize && !matchedVariant && (
            <p className="mt-1 text-xs text-gray-400">
              Diese Größe gibt es für dieses Modell noch nicht — die
              Bestellung wird trotzdem gespeichert.
            </p>
          )}
          {isNewModel && (
            <p className="mt-1 text-xs text-gray-400">
              Das Modell gibt es im Armbandbestand noch nicht — die
              Bestellung wird trotzdem gespeichert, damit sie nicht vergessen
              wird.
            </p>
          )}
        </div>
      )}

      {matchedVariant && (
        <input type="hidden" name="bracelet_id" value={matchedVariant.id} />
      )}
      {selectedModel && selectedSize && !matchedVariant && (
        <input
          type="hidden"
          name="wish_text"
          value={`${selectedModel.name} (Größe ${selectedSize}, noch nicht angelegt)`}
        />
      )}
      {isNewModel && newModelName && selectedSize && (
        <input
          type="hidden"
          name="wish_text"
          value={`${newModelName} (Größe ${selectedSize}, Modell noch nicht angelegt)`}
        />
      )}

      {selectedKey === "" && (
        <div>
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="wish_text"
          >
            oder: Wunsch-Beschreibung
          </label>
          <textarea
            id="wish_text"
            name="wish_text"
            rows={3}
            defaultValue={initialWishText}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Entweder ein Modell wählen oder einen Wunsch-Text eintragen, nicht
            beides.
          </p>
        </div>
      )}
    </div>
  );
}
