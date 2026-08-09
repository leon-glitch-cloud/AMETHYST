import { createSupabaseServerClient } from "@/lib/supabase/server";

const BRACELET_SIZES = ["S", "M", "L"] as const;

export type BraceletModelOption = {
  key: string;
  name: string;
  sizes: { id: string; size: string | null }[];
};

export async function getBraceletModels(): Promise<BraceletModelOption[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bracelets")
      .select("id, name, size, variant_group_id")
      .order("name", { ascending: true });
    if (error || !data) return [];

    const groups = new Map<
      string,
      { id: string; name: string; size: string | null }[]
    >();
    data.forEach((row) => {
      const key = row.variant_group_id ?? row.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ id: row.id, name: row.name, size: row.size });
    });

    return Array.from(groups.values())
      .map((rows) => ({
        key: rows[0].id,
        name: rows[0].name,
        sizes: rows
          .map((row) => ({ id: row.id, size: row.size }))
          .sort(
            (a, b) =>
              BRACELET_SIZES.indexOf(
                (a.size ?? "") as (typeof BRACELET_SIZES)[number]
              ) -
              BRACELET_SIZES.indexOf(
                (b.size ?? "") as (typeof BRACELET_SIZES)[number]
              )
          ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// Erkennt die automatisch von OrderModelPicker erzeugten Wunsch-Texte
// ("Modellname (Größe X, [Modell ]noch nicht angelegt)"), z. B. wenn eine
// Bestellung für ein Modell/eine Größe erfasst wurde, die es im
// Armbandbestand noch nicht gibt.
const AUTO_WISH_TEXT_PATTERN =
  /^(.+) \(Größe (S|M|L), (?:Modell )?noch nicht angelegt\)$/;

export function parseAutoWishText(
  wishText: string
): { modelName: string; size: string } | null {
  const match = wishText.match(AUTO_WISH_TEXT_PATTERN);
  if (!match) return null;
  const [, modelName, size] = match;
  return { modelName, size };
}
