"use client";

import { useState } from "react";
import { PersonSelect } from "@/app/_components/person-select";

export function BookExpenseToggle() {
  const [checked, setChecked] = useState(false);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          name="book_expense"
          value="yes"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        Als Materialausgabe im Verlauf buchen
      </label>
      {checked && (
        <div className="max-w-xs">
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="material_order_person"
          >
            Von
          </label>
          <PersonSelect id="material_order_person" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500" />
        </div>
      )}
    </div>
  );
}
