import Link from "next/link";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-2xl font-medium text-gray-900">{title}</h1>
      <p className="text-gray-500">Dieser Bereich ist noch in Arbeit.</p>
      <Link
        href="/"
        className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
      >
        Zurück zur Startseite
      </Link>
    </main>
  );
}
