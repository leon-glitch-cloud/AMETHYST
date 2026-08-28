import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BackLink } from "@/app/_components/back-link";
import { BRACELET_SIZES } from "@/lib/bracelet-sizes";

type Bracelet = {
  id: string;
  name: string;
  photo_url: string | null;
  made_count: number;
  size: string | null;
  variant_group_id: string | null;
};

type BraceletCard = {
  id: string;
  name: string;
  photo_url: string | null;
  sizes: string[];
  inStock: number;
  sold: number;
  loaned: number;
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
      .select("id, name, photo_url, made_count, size, variant_group_id")
      .order("name", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

function groupBracelets(bracelets: Bracelet[], counts: Counts): BraceletCard[] {
  const groups = new Map<string, Bracelet[]>();
  bracelets.forEach((bracelet) => {
    const key = bracelet.variant_group_id ?? bracelet.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bracelet);
  });

  const cards = Array.from(groups.values()).map((group) => {
    const representative = group.find((b) => b.photo_url) ?? group[0];
    const madeCount = group.reduce((sum, b) => sum + b.made_count, 0);
    const sold = group.reduce(
      (sum, b) => sum + (counts.sold.get(b.id) ?? 0),
      0
    );
    const loaned = group.reduce(
      (sum, b) => sum + (counts.loaned.get(b.id) ?? 0),
      0
    );
    const sizes = group
      .map((b) => b.size)
      .filter((size): size is string => Boolean(size))
      .sort(
        (a, b) =>
          BRACELET_SIZES.indexOf(a as (typeof BRACELET_SIZES)[number]) -
          BRACELET_SIZES.indexOf(b as (typeof BRACELET_SIZES)[number])
      );

    return {
      id: representative.id,
      name: representative.name,
      photo_url: representative.photo_url,
      sizes,
      inStock: madeCount - sold - loaned,
      sold,
      loaned,
    };
  });

  return cards.sort((a, b) => a.name.localeCompare(b.name));
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

  const cards = groupBracelets(bracelets, counts);

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

      {cards.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Noch keine Armbänder angelegt.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {cards.map((card) => {
            const soldOut = card.inStock <= 0;

            return (
              <li key={card.id}>
                <Link
                  href={`/bracelets/${card.id}`}
                  className={`block overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:border-gray-400 ${
                    soldOut ? "opacity-60" : ""
                  }`}
                >
                  <div className="relative flex h-40 items-center justify-center bg-gray-100">
                    {card.photo_url ? (
                      <Image
                        src={card.photo_url}
                        alt={card.name}
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
                      {card.name}
                      {card.sizes.map((size) => (
                        <span
                          key={size}
                          className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500"
                        >
                          {size}
                        </span>
                      ))}
                    </p>
                    <p className="text-sm text-gray-500">
                      {Math.max(card.inStock, 0)} auf Lager · {card.loaned}{" "}
                      verliehen · {card.sold} verkauft
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
