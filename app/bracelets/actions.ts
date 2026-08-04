"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadPublicImage } from "@/lib/supabase/storage";
import { parseNumber, parseText } from "@/lib/forms";
import { createSaleTransaction } from "@/lib/sales";
import { createClaudeClient } from "@/lib/claude";

function parseBeadItems(
  formData: FormData
): { bead_id: string; quantity: number }[] {
  const beadIds = formData.getAll("bead_id");
  const quantities = formData.getAll("quantity");
  const items: { bead_id: string; quantity: number }[] = [];

  beadIds.forEach((rawId, index) => {
    if (typeof rawId !== "string" || rawId.trim() === "") return;
    const quantity = parseNumber(quantities[index] ?? null);
    if (!quantity || quantity <= 0) return;
    items.push({ bead_id: rawId, quantity });
  });

  return items;
}

function braceletFieldsFromFormData(formData: FormData) {
  return {
    made_count: parseNumber(formData.get("made_count")) ?? 0,
    notes: parseText(formData.get("notes")),
  };
}

export async function createBracelet(formData: FormData) {
  const name = parseText(formData.get("name"));
  if (!name) {
    redirect(
      `/bracelets/new?error=${encodeURIComponent("Name ist erforderlich")}`
    );
  }

  const id = crypto.randomUUID();
  let photoUrl: string | null = null;

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await uploadPublicImage(
        "bracelet-photos",
        `${id}/${photo.name}`,
        photo
      );
    } catch {
      redirect(
        `/bracelets/new?error=${encodeURIComponent("Foto-Upload fehlgeschlagen")}`
      );
    }
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("bracelets").insert({
    id,
    name,
    photo_url: photoUrl,
    ...braceletFieldsFromFormData(formData),
  });

  if (error) {
    redirect(
      `/bracelets/new?error=${encodeURIComponent("Armband konnte nicht gespeichert werden")}`
    );
  }

  const items = parseBeadItems(formData);
  if (items.length > 0) {
    const { error: beadsError } = await supabase.from("bracelet_beads").insert(
      items.map((item) => ({
        bracelet_id: id,
        bead_id: item.bead_id,
        quantity: item.quantity,
      }))
    );
    if (beadsError) {
      redirect(
        `/bracelets/${id}?error=${encodeURIComponent(
          "Perlen-Verknüpfung konnte nicht vollständig gespeichert werden"
        )}`
      );
    }
  }

  redirect(`/bracelets/${id}`);
}

export async function updateBracelet(id: string, formData: FormData) {
  const name = parseText(formData.get("name"));
  if (!name) {
    redirect(
      `/bracelets/${id}/edit?error=${encodeURIComponent("Name ist erforderlich")}`
    );
  }

  const supabase = createSupabaseServerClient();

  let photoUrl: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await uploadPublicImage(
        "bracelet-photos",
        `${id}/${photo.name}`,
        photo
      );
    } catch {
      redirect(
        `/bracelets/${id}/edit?error=${encodeURIComponent("Foto-Upload fehlgeschlagen")}`
      );
    }
  }

  const { error } = await supabase
    .from("bracelets")
    .update({
      name,
      ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
      ...braceletFieldsFromFormData(formData),
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/bracelets/${id}/edit?error=${encodeURIComponent("Armband konnte nicht gespeichert werden")}`
    );
  }

  // Neue Verknüpfungen zuerst einfügen, dann die alten löschen – so entsteht
  // kein Datenverlust-Fenster, falls der Insert mittendrin fehlschlägt.
  const { data: oldLinks } = await supabase
    .from("bracelet_beads")
    .select("id")
    .eq("bracelet_id", id);
  const oldIds = (oldLinks ?? []).map((row) => row.id as string);

  const items = parseBeadItems(formData);
  if (items.length > 0) {
    const { error: insertError } = await supabase.from("bracelet_beads").insert(
      items.map((item) => ({
        bracelet_id: id,
        bead_id: item.bead_id,
        quantity: item.quantity,
      }))
    );
    if (insertError) {
      redirect(
        `/bracelets/${id}/edit?error=${encodeURIComponent(
          "Perlen-Verknüpfung konnte nicht gespeichert werden"
        )}`
      );
    }
  }

  if (oldIds.length > 0) {
    await supabase.from("bracelet_beads").delete().in("id", oldIds);
  }

  redirect(`/bracelets/${id}`);
}

export async function deleteBracelet(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("bracelets").delete().eq("id", id);

  if (error) {
    redirect(
      `/bracelets/${id}?error=${encodeURIComponent("Armband konnte nicht gelöscht werden")}`
    );
  }

  redirect("/bracelets");
}

export async function recordLoan(braceletId: string, formData: FormData) {
  const borrowerName = parseText(formData.get("borrower_name"));
  if (!borrowerName) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent("Name ist erforderlich")}`
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("loans").insert({
    bracelet_id: braceletId,
    borrower_name: borrowerName,
  });

  if (error) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent(
        "Verleihung konnte nicht gespeichert werden"
      )}`
    );
  }

  redirect(`/bracelets/${braceletId}`);
}

export async function returnLoan(loanId: string, braceletId: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("loans")
    .update({ returned_at: new Date().toISOString() })
    .eq("id", loanId);

  if (error) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent(
        "Rückgabe konnte nicht gespeichert werden"
      )}`
    );
  }

  redirect(`/bracelets/${braceletId}`);
}

export async function recordSale(braceletId: string, formData: FormData) {
  const buyerName = parseText(formData.get("buyer_name"));
  if (!buyerName) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent("Käufer ist erforderlich")}`
    );
  }

  const isGift = formData.get("is_gift") === "yes";
  const price = isGift ? 0 : (parseNumber(formData.get("price")) ?? 0);

  const supabase = createSupabaseServerClient();
  const { data: bracelet } = await supabase
    .from("bracelets")
    .select("name")
    .eq("id", braceletId)
    .maybeSingle();

  const result = await createSaleTransaction({
    braceletId,
    braceletName: bracelet?.name ?? "Armband",
    buyerName,
    price,
    isGift,
  });

  if (!result.ok) {
    redirect(`/bracelets/${braceletId}?error=${encodeURIComponent(result.message)}`);
  }

  redirect(`/bracelets/${braceletId}`);
}

type SuggestBeadsResult =
  | { ok: true; items: { bead_id: string; quantity: number }[] }
  | { ok: false; message: string };

const BEAD_SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          article_number: { type: "string" },
          quantity: { type: "integer" },
        },
        required: ["article_number", "quantity"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

type SuggestionContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } }
  | {
      type: "image";
      source: { type: "base64"; media_type: ImageMediaType; data: string };
    };

function toImageMediaType(mimeType: string): ImageMediaType {
  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/gif" ||
    mimeType === "image/webp"
  ) {
    return mimeType;
  }
  return "image/jpeg";
}

export async function suggestBeadsFromPhoto(
  formData: FormData
): Promise<SuggestBeadsResult> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, message: "Bitte zuerst ein Foto auswählen" };
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: beads, error } = await supabase
      .from("beads")
      .select("id, article_number, color, size_mm, image_url");

    if (error || !beads || beads.length === 0) {
      return {
        ok: false,
        message: "Noch keine Perlen im Materialbestand angelegt",
      };
    }

    const bytes = await photo.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = toImageMediaType(photo.type);

    const content: SuggestionContentBlock[] = [];

    for (const bead of beads) {
      if (!bead.image_url) continue;
      content.push({
        type: "text",
        text: `Referenzbild für Perle "${bead.article_number}" (Farbe: ${bead.color ?? "unbekannt"}, Größe: ${bead.size_mm ?? "unbekannt"}mm):`,
      });
      content.push({
        type: "image",
        source: { type: "url", url: bead.image_url },
      });
    }

    const catalogText = beads
      .map(
        (bead) =>
          `- ${bead.article_number}: Farbe ${bead.color ?? "unbekannt"}, Größe ${bead.size_mm ?? "unbekannt"}mm${bead.image_url ? "" : " (kein Referenzfoto)"}`
      )
      .join("\n");

    content.push({
      type: "text",
      text: `Vollständiger Perlen-Katalog (Artikelnummer: Farbe, Größe):\n${catalogText}`,
    });
    content.push({
      type: "text",
      text: "Hier ist das Foto eines fertigen Armbands. Zähle, welche Perlen aus dem obigen Katalog wie oft verbaut sind, und ordne sie möglichst genau der passenden Artikelnummer zu. Antworte ausschließlich mit dem geforderten JSON.",
    });
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });

    const client = createClaudeClient();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: {
        format: { type: "json_schema", schema: BEAD_SUGGESTION_SCHEMA },
      },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        message: "Die KI konnte das Foto nicht analysieren (abgelehnt)",
      };
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, message: "Keine Antwort von der KI erhalten" };
    }

    const parsed = JSON.parse(textBlock.text) as {
      items: { article_number: string; quantity: number }[];
    };

    const beadsByArticleNumber = new Map(
      beads.map((bead) => [bead.article_number, bead.id])
    );

    const items = parsed.items
      .filter(
        (item) =>
          item.quantity > 0 && beadsByArticleNumber.has(item.article_number)
      )
      .map((item) => ({
        bead_id: beadsByArticleNumber.get(item.article_number) as string,
        quantity: item.quantity,
      }));

    return { ok: true, items };
  } catch {
    return { ok: false, message: "Perlen-Erkennung ist fehlgeschlagen" };
  }
}
