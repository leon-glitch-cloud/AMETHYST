"use client";

import { useState } from "react";

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M10 3v9M6.5 7.5 10 4l3.5 3.5" />
      <path d="M4 13.5v1.75c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25V13.5" />
    </svg>
  );
}

export function FileUploadField({
  id,
  name,
  label,
  buttonLabel = "Datei auswählen",
  accept,
  required,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  buttonLabel?: string;
  accept?: string;
  required?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600" htmlFor={id}>
        {label}
      </label>
      <div className="relative inline-flex items-center gap-2 overflow-hidden rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
        <UploadIcon />
        {buttonLabel}
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name ?? null);
            onChange?.(event);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      {fileName && <p className="mt-1 text-xs text-gray-500">{fileName}</p>}
    </div>
  );
}
