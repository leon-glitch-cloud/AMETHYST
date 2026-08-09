import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Zurück"
      className="mb-4 inline-flex items-center gap-0.5 text-sm text-gray-500 transition hover:text-gray-900"
    >
      <ChevronLeft className="h-4 w-4" />
      Zurück
    </Link>
  );
}
