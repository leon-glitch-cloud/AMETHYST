"use client";

import { SubmitButton } from "@/app/_components/submit-button";

export function ConfirmFormButton({
  action,
  label,
  confirmMessage,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  confirmMessage: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton
        className={
          className ??
          "text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900"
        }
      >
        {label}
      </SubmitButton>
    </form>
  );
}
