"use client";

import { useState } from "react";
import { SubmitButton } from "@/app/_components/submit-button";

export function BraceletEventForm({
  action,
  sizeOptions,
  currentId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  sizeOptions?: { id: string; size: string | null }[];
  currentId?: string;
}) {
  const [eventType, setEventType] = useState("sold");

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="person_name"
        type="text"
        placeholder="Name"
        required
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
      />
      {sizeOptions && sizeOptions.length > 1 && (
        <select
          name="bracelet_id"
          defaultValue={currentId}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
        >
          {sizeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.size ?? "?"}
            </option>
          ))}
        </select>
      )}
      <select
        name="event_type"
        value={eventType}
        onChange={(event) => setEventType(event.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
      >
        <option value="sold">Verkauft</option>
        <option value="loaned">Verliehen</option>
        <option value="gift">Verschenkt</option>
      </select>
      {eventType === "sold" && (
        <input
          name="price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Preis (€)"
          required
          className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
        />
      )}
      <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
    </form>
  );
}
