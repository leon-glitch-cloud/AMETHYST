import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BackLink } from "@/app/_components/back-link";

type Bracelet = {
  id: string;
  name: string;
  photo_url: string | null;
  made_count: number;
  size: string | null;
};

type Counts = {
  sold: Map<string, number>;
  loaned: Map<string, number>;
};

async function getBracelets(): Promise<Bracelet[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bracelets")
      .select("id, name, photo_url, made_count, size")
      .order("name", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

async function getCounts(): Promise<Counts> {
  try {
    const supabase = createSupabaseServerClient();
    const [{ data: sales }, { data: loans }] = await Promise.all([
      supabase.from("sales").select("bracelet_id"),
      supabase.from("loans").select("bracelet_id").is("returned_at", null),
    ]);

    const sold = new Map<string, number>();
    (sales ?? []).forEach((row) => {
      sold.set(row.bracelet_id, (sold.get(row.bracelet_id) ?? 0) + 1);
    });

    const loaned = new Map<string, number>();
    (loans ?? []).forEach((row) => {
      loaned.set(row.bracelet_id, (loaned.get(row.bracelet_id) ?? 0) + 1);
    });

    return { sold, loaned };
  } catch {
    return { sold: new Map(), loaned: new Map() };
  }
}

export default async function BraceletsPage() {
  const [bracelets, counts] = await Promise.all([
    getBracelets(),
    getCounts(),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-12">
      <BackLink href="/" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-gray-900">Armbandbestand</h1>
        <Link
          href="/bracelets/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          + Neues Armband
        </Link>
      </div>

      {bracelets.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Noch keine Armbänder angelegt.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {bracelets.map((bracelet) => {
            const sold = counts.sold.get(bracelet.id) ?? 0;
            const loaned = counts.loaned.get(bracelet.id) ?? 0;
            const inStock = bracelet.made_count - sold - loaned;
            const soldOut = inStock <= 0;

            return (
              <li key={bracelet.id}>
                <Link
                  href={`/bracelets/${bracelet.id}`}
                  className={`block overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:border-gray-400 ${
                    soldOut ? "opacity-60" : ""
                  }`}
                >
                  <div className="relative flex h-40 items-center justify-center bg-gray-100">
                    {bracelet.photo_url ? (
                      <Image
                        src={bracelet.photo_url}
                        alt={bracelet.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">Kein Bild</span>
                    )}
                    {soldOut && (
                      <span className="absolute right-2 top-2 rounded-full bg-gray-900 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                        Ausverkauft
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="mb-1 text-sm font-medium text-gray-900">
                      {bracelet.name}
                      {bracelet.size && (
                        <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                          {bracelet.size}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {Math.max(inStock, 0)} auf Lager · {loaned} verliehen ·{" "}
                      {sold} verkauft
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/"
        className="mt-8 inline-block text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
      >
        Zurück zur Startseite
      </Link>
    </main>
  );
}
