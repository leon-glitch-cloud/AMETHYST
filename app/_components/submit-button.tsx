"use client";

import { useFormStatus } from "react-dom";
import { AmethystSpinner } from "./amethyst-spinner";

const DEFAULT_CLASSNAME =
  "inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70";

export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className ?? DEFAULT_CLASSNAME}
    >
      {pending && <AmethystSpinner size={14} />}
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
