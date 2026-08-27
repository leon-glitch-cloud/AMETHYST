"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadPublicImage } from "@/lib/supabase/storage";
import { parseNumber, parseText } from "@/lib/forms";
import { createSaleTransaction } from "@/lib/sales";
import { createClaudeClient, logClaudeError, toImageMediaType } from "@/lib/claude";
import { BRACELET_SIZES } from "@/lib/bracelet-sizes";

function parseBeadItems(
  formData: FormData
): { bead_id: string | null; quantity: number; unknown_description: string | null }[] {
  const beadIds = formData.getAll("bead_id");
  const quantities = formData.getAll("quantity");
  const descriptions = formData.getAll("unknown_description");
  const items: {
    bead_id: string | null;
    quantity: number;
    unknown_description: string | null;
  }[] = [];

  beadIds.forEach((rawId, index) => {
    const beadId =
      typeof rawId === "string" && rawId.trim() !== "" ? rawId : null;
    const description = parseText(descriptions[index] ?? null);
    if (!beadId && !description) return;
    const quantity = parseNumber(quantities[index] ?? null);
    if (!quantity || quantity <= 0) return;
    items.push({
      bead_id: beadId,
      quantity,
      unknown_description: beadId ? null : description,
    });
  });

  return items;
}

function braceletFieldsFromFormData(formData: FormData) {
  return {
    notes: parseText(formData.get("notes")),
  };
}

async function getBraceletStock(
  braceletId: string,
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<number> {
  const [{ data: bracelet }, { count: usedCount }, { count: loanedCount }] =
    await Promise.all([
      supabase
        .from("bracelets")
        .select("made_count")
        .eq("id", braceletId)
        .maybeSingle(),
      supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("bracelet_id", braceletId),
      supabase
        .from("loans")
        .select("id", { count: "exact", head: true })
        .eq("bracelet_id", braceletId)
        .is("returned_at", null),
    ]);

  return (bracelet?.made_count ?? 0) - (usedCount ?? 0) - (loanedCount ?? 0);
}

export async function createBracelet(formData: FormData) {
  const name = parseText(formData.get("name"));
  if (!name) {
    redirect(
      `/bracelets/new?error=${encodeURIComponent("Name ist erforderlich")}`
    );
  }

  const photo = formData.get("photo");
  const photoFile = photo instanceof File && photo.size > 0 ? photo : null;
  const autoDetectBeads = formData.get("auto_detect_beads") === "yes";

  if (autoDetectBeads && !photoFile) {
    redirect(
      `/bracelets/new?error=${encodeURIComponent(
        "Für die automatische Perlen-Erkennung wird ein Foto benötigt"
      )}`
    );
  }

  const id = crypto.randomUUID();
  let photoUrl: string | null = null;

  if (photoFile) {
    try {
      photoUrl = await uploadPublicImage(
        "bracelet-photos",
        `${id}/${photoFile.name}`,
        photoFile
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
    made_count: 0,
    ...braceletFieldsFromFormData(formData),
  });

  if (error) {
    redirect(
      `/bracelets/new?error=${encodeURIComponent("Armband konnte nicht gespeichert werden")}`
    );
  }

  revalidatePath("/bracelets");

  let beadDetectionError: string | null = null;

  if (autoDetectBeads && photoFile) {
    const suggestion = await suggestBeadItemsFromPhoto(photoFile);
    if (!suggestion.ok) {
      beadDetectionError = suggestion.message;
    } else if (suggestion.items.length > 0) {
      const { error: beadsError } = await supabase
        .from("bracelet_beads")
        .insert(
          suggestion.items.map((item) => ({
            bracelet_id: id,
            bead_id: item.bead_id,
            quantity: item.quantity,
            unknown_description: item.unknown_description,
          }))
        );
      if (beadsError) {
        beadDetectionError =
          "Perlen-Verknüpfung konnte nicht vollständig gespeichert werden";
      }
    }
  }

  redirect(
    beadDetectionError
      ? `/bracelets/${id}?error=${encodeURIComponent(beadDetectionError)}`
      : `/bracelets/${id}`
  );
}

type SuggestBraceletNameResult =
  | { ok: true; name: string }
  | { ok: false; message: string };

const BRACELET_NAME_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        'Kurzer, einprägsamer deutscher Produktname für das Armband, basierend auf Farben/Stil des Fotos (z. B. "Orange-Blau" oder ein passendes Stimmungswort). Maximal 3-4 Wörter, keine Anführungszeichen, das Wort "Armband" nicht mit einschließen.',
    },
  },
  required: ["name"],
  additionalProperties: false,
} as const;

export async function suggestBraceletNameFromPhoto(
  formData: FormData
): Promise<SuggestBraceletNameResult> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, message: "Bitte zuerst ein Foto auswählen" };
  }

  try {
    const resizedBytes = await sharp(Buffer.from(await photo.arrayBuffer()))
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const base64 = resizedBytes.toString("base64");

    const client = createClaudeClient();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 256,
      thinking: { type: "disabled" },
      output_config: {
        format: { type: "json_schema", schema: BRACELET_NAME_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hier ist das Foto eines handgefertigten Perlenarmbands. Schlage einen kurzen, einprägsamen Produktnamen auf Deutsch vor, der zu Farben/Stil des Armbands passt. Antworte ausschließlich mit dem geforderten JSON.",
            },
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: base64 },
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        message: "Die KI konnte keinen Namen vorschlagen (abgelehnt)",
      };
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, message: "Keine Antwort von der KI erhalten" };
    }

    const parsed = JSON.parse(textBlock.text) as { name: string };
    const name = parsed.name?.trim();
    if (!name) {
      return { ok: false, message: "Kein Name erhalten" };
    }

    return { ok: true, name };
  } catch (err) {
    logClaudeError("suggestBraceletNameFromPhoto", err);
    return { ok: false, message: "Namensvorschlag ist fehlgeschlagen" };
  }
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
        unknown_description: item.unknown_description,
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

  revalidatePath("/bracelets");
  redirect(`/bracelets/${id}`);
}

export async function increaseMadeCount(braceletId: string) {
  const supabase = createSupabaseServerClient();
  const { data: bracelet } = await supabase
    .from("bracelets")
    .select("made_count")
    .eq("id", braceletId)
    .maybeSingle();

  const { error } = await supabase
    .from("bracelets")
    .update({ made_count: (bracelet?.made_count ?? 0) + 1 })
    .eq("id", braceletId);

  if (error) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent(
        "Lagerbestand konnte nicht erhöht werden"
      )}`
    );
  }

  revalidatePath("/bracelets");
  revalidatePath("/");
  redirect(`/bracelets/${braceletId}`);
}

export async function decreaseMadeCount(braceletId: string) {
  const supabase = createSupabaseServerClient();
  const { data: bracelet } = await supabase
    .from("bracelets")
    .select("made_count")
    .eq("id", braceletId)
    .maybeSingle();

  const newCount = Math.max((bracelet?.made_count ?? 0) - 1, 0);

  const { error } = await supabase
    .from("bracelets")
    .update({ made_count: newCount })
    .eq("id", braceletId);

  if (error) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent(
        "Lagerbestand konnte nicht verringert werden"
      )}`
    );
  }

  revalidatePath("/bracelets");
  revalidatePath("/");
  redirect(`/bracelets/${braceletId}`);
}

export async function deleteBracelet(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("bracelets").delete().eq("id", id);

  if (error) {
    redirect(
      `/bracelets/${id}?error=${encodeURIComponent("Armband konnte nicht gelöscht werden")}`
    );
  }

  revalidatePath("/bracelets");
  redirect("/bracelets");
}

type BraceletSize = (typeof BRACELET_SIZES)[number];

function isBraceletSize(value: unknown): value is BraceletSize {
  return typeof value === "string" && (BRACELET_SIZES as readonly string[]).includes(value);
}

export async function addBraceletSizeVariant(
  braceletId: string,
  formData: FormData
) {
  const newSizeRaw = formData.get("new_size");
  if (!isBraceletSize(newSizeRaw)) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent(
        "Bitte eine gültige Größe auswählen"
      )}`
    );
  }
  const newSize = newSizeRaw;

  const supabase = createSupabaseServerClient();
  const { data: bracelet, error: braceletError } = await supabase
    .from("bracelets")
    .select("id, name, photo_url, notes, size, variant_group_id")
    .eq("id", braceletId)
    .maybeSingle();

  if (braceletError || !bracelet) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent(
        "Armband nicht gefunden"
      )}`
    );
  }

  let groupId = bracelet.variant_group_id;
  let currentSize = bracelet.size;

  if (!groupId) {
    const currentSizeRaw = formData.get("current_size");
    if (!isBraceletSize(currentSizeRaw)) {
      redirect(
        `/bracelets/${braceletId}?error=${encodeURIComponent(
          "Bitte auch die Größe des aktuellen Armbands auswählen"
        )}`
      );
    }
    if (currentSizeRaw === newSize) {
      redirect(
        `/bracelets/${braceletId}?error=${encodeURIComponent(
          "Die neue Größe muss sich von der aktuellen unterscheiden"
        )}`
      );
    }
    currentSize = currentSizeRaw;
    groupId = crypto.randomUUID();

    const { error: updateError } = await supabase
      .from("bracelets")
      .update({ size: currentSize, variant_group_id: groupId })
      .eq("id", braceletId);
    if (updateError) {
      redirect(
        `/bracelets/${braceletId}?error=${encodeURIComponent(
          "Größe konnte nicht gespeichert werden"
        )}`
      );
    }
  } else {
    const { data: siblings } = await supabase
      .from("bracelets")
      .select("size")
      .eq("variant_group_id", groupId);
    if ((siblings ?? []).some((sibling) => sibling.size === newSize)) {
      redirect(
        `/bracelets/${braceletId}?error=${encodeURIComponent(
          `Größe ${newSize} gibt es in dieser Gruppe schon`
        )}`
      );
    }
  }

  const { data: beadRows } = await supabase
    .from("bracelet_beads")
    .select("bead_id, quantity, unknown_description")
    .eq("bracelet_id", braceletId);

  const newId = crypto.randomUUID();
  const { error: insertError } = await supabase.from("bracelets").insert({
    id: newId,
    name: bracelet.name,
    photo_url: bracelet.photo_url,
    notes: bracelet.notes,
    made_count: 0,
    size: newSize,
    variant_group_id: groupId,
  });

  if (insertError) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent(
        "Neue Größe konnte nicht angelegt werden"
      )}`
    );
  }

  if (beadRows && beadRows.length > 0) {
    await supabase.from("bracelet_beads").insert(
      beadRows.map((row) => ({
        bracelet_id: newId,
        bead_id: row.bead_id,
        quantity: row.quantity,
        unknown_description: row.unknown_description,
      }))
    );
  }

  revalidatePath("/bracelets");
  redirect(`/bracelets/${newId}`);
}

export async function deleteSizeVariant(variantId: string, currentViewId: string) {
  const supabase = createSupabaseServerClient();

  const { data: variant } = await supabase
    .from("bracelets")
    .select("variant_group_id")
    .eq("id", variantId)
    .maybeSingle();

  const { error } = await supabase.from("bracelets").delete().eq("id", variantId);

  if (error) {
    redirect(
      `/bracelets/${currentViewId}?error=${encodeURIComponent(
        "Größe konnte nicht gelöscht werden"
      )}`
    );
  }

  revalidatePath("/bracelets");

  if (variantId !== currentViewId) {
    redirect(`/bracelets/${currentViewId}`);
  }

  if (variant?.variant_group_id) {
    const { data: siblings } = await supabase
      .from("bracelets")
      .select("id")
      .eq("variant_group_id", variant.variant_group_id)
      .limit(1);
    if (siblings && siblings.length > 0) {
      redirect(`/bracelets/${siblings[0].id}`);
    }
  }

  redirect("/bracelets");
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

  revalidatePath("/bracelets");
  redirect(`/bracelets/${braceletId}`);
}

export async function recordBraceletEvent(
  braceletId: string,
  formData: FormData
) {
  const personName = parseText(formData.get("person_name"));
  if (!personName) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent("Name ist erforderlich")}`
    );
  }

  const eventType = formData.get("event_type");
  const targetBraceletIdRaw = formData.get("bracelet_id");
  const targetBraceletId =
    typeof targetBraceletIdRaw === "string" && targetBraceletIdRaw.trim() !== ""
      ? targetBraceletIdRaw
      : braceletId;
  const supabase = createSupabaseServerClient();

  const stock = await getBraceletStock(targetBraceletId, supabase);
  if (stock <= 0) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent(
        "Kein Armband mehr auf Lager"
      )}`
    );
  }

  if (eventType === "loaned") {
    const { error } = await supabase.from("loans").insert({
      bracelet_id: targetBraceletId,
      borrower_name: personName,
    });

    if (error) {
      redirect(
        `/bracelets/${braceletId}?error=${encodeURIComponent(
          "Verleihung konnte nicht gespeichert werden"
        )}`
      );
    }

    revalidatePath("/bracelets");
    redirect(`/bracelets/${braceletId}`);
  }

  const isGift = eventType === "gift";
  const price = isGift ? 0 : (parseNumber(formData.get("price")) ?? 0);
  const person = parseText(formData.get("person"));

  const { data: bracelet } = await supabase
    .from("bracelets")
    .select("name")
    .eq("id", targetBraceletId)
    .maybeSingle();

  const result = await createSaleTransaction({
    braceletId: targetBraceletId,
    braceletName: bracelet?.name ?? "Armband",
    buyerName: personName,
    price,
    isGift,
    person,
  });

  if (!result.ok) {
    redirect(`/bracelets/${braceletId}?error=${encodeURIComponent(result.message)}`);
  }

  redirect(`/bracelets/${braceletId}`);
}

export async function deleteSale(saleId: string, braceletId: string) {
  const supabase = createSupabaseServerClient();
  const { data: sale } = await supabase
    .from("sales")
    .select("transaction_id")
    .eq("id", saleId)
    .maybeSingle();

  const { error } = await supabase.from("sales").delete().eq("id", saleId);

  if (error) {
    redirect(
      `/bracelets/${braceletId}?error=${encodeURIComponent(
        "Verkauf konnte nicht gelöscht werden"
      )}`
    );
  }

  if (sale?.transaction_id) {
    await supabase.from("transactions").delete().eq("id", sale.transaction_id);
  }

  revalidatePath("/bracelets");
  revalidatePath("/");
  redirect(`/bracelets/${braceletId}`);
}

type SuggestBeadsResult =
  | {
      ok: true;
      items: {
        bead_id: string | null;
        quantity: number;
        unknown_description: string | null;
      }[];
    }
  | { ok: false; message: string };

const BEAD_SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          article_number: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          quantity: { type: "integer" },
        },
        required: ["article_number", "description", "quantity"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

type SuggestionContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: ReturnType<typeof toImageMediaType>;
        data: string;
      };
    };

export async function suggestBeadsFromPhoto(
  formData: FormData
): Promise<SuggestBeadsResult> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, message: "Bitte zuerst ein Foto auswählen" };
  }

  return suggestBeadItemsFromPhoto(photo);
}

async function suggestBeadItemsFromPhoto(
  photo: File
): Promise<SuggestBeadsResult> {
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

    // Anthropic lehnt Anfragen mit vielen Bildern ab, sobald eins davon
    // eine Kante über 2000px hat ("many-image requests" limit) — und die
    // Gesamtanfrage hat zusätzlich ein Größenlimit, das mit wachsendem
    // Perlenkatalog schnell erreicht ist. Neu hochgeladene Fotos werden
    // schon beim Upload verkleinert, aber ältere Referenzfotos könnten
    // noch groß sein — deshalb hier zur Sicherheit nochmal verkleinern
    // und als JPEG komprimieren, statt sie unverändert durchzureichen.
    const resizedBytes = await sharp(Buffer.from(await photo.arrayBuffer()))
      .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const base64 = resizedBytes.toString("base64");
    const mediaType: ReturnType<typeof toImageMediaType> = "image/jpeg";

    const content: SuggestionContentBlock[] = [];

    for (const bead of beads) {
      if (!bead.image_url) continue;
      try {
        const refResponse = await fetch(bead.image_url);
        if (!refResponse.ok) continue;
        // Referenzfotos müssen nur zum groben Farb-/Formvergleich reichen,
        // nicht hochauflösend sein — klein halten, damit die Gesamtanfrage
        // auch bei einem großen Perlenkatalog unter dem Größenlimit bleibt.
        const refBuffer = await sharp(
          Buffer.from(await refResponse.arrayBuffer())
        )
          .resize({
            width: 500,
            height: 500,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 70 })
          .toBuffer();
        const refMediaType: ReturnType<typeof toImageMediaType> = "image/jpeg";
        content.push({
          type: "text",
          text: `Referenzbild für Perle "${bead.article_number}" (Farbe: ${bead.color ?? "unbekannt"}, Größe: ${bead.size_mm ?? "unbekannt"}mm):`,
        });
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: refMediaType,
            data: refBuffer.toString("base64"),
          },
        });
      } catch (err) {
        logClaudeError("suggestBeadsFromPhoto:reference-photo", err);
      }
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
      text: 'Hier ist das Foto eines fertigen Armbands. Zähle alle verbauten Perlen. Für jede Perle, die im obigen Katalog vorhanden ist: setze article_number auf die passende Artikelnummer, description auf null. Für jede verbaute Perle, die NICHT im Katalog vorhanden ist: setze article_number auf null und beschreibe die Perle stattdessen kurz in description (Farbe, Form, ungefähre Größe), damit sie später im Materialbestand wiedergefunden werden kann. Fasse dabei möglichst gleich aussehende Perlen zu einer Position mit entsprechender quantity zusammen, statt sie einzeln aufzulisten. Antworte ausschließlich mit dem geforderten JSON.',
    });
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });

    const client = createClaudeClient();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      thinking: { type: "disabled" },
      output_config: {
        format: { type: "json_schema", schema: BEAD_SUGGESTION_SCHEMA },
      },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      console.error(
        "[suggestBeadsFromPhoto] Claude hat die Analyse verweigert (stop_reason=refusal)",
        { content: response.content }
      );
      return {
        ok: false,
        message: "Die KI konnte das Foto nicht analysieren (abgelehnt)",
      };
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error(
        "[suggestBeadsFromPhoto] Keine Text-Antwort im Claude-Response enthalten",
        { stop_reason: response.stop_reason, content: response.content }
      );
      return { ok: false, message: "Keine Antwort von der KI erhalten" };
    }

    const parsed = JSON.parse(textBlock.text) as {
      items: {
        article_number: string | null;
        description: string | null;
        quantity: number;
      }[];
    };

    console.log("[suggestBeadsFromPhoto] Claude-Vorschlag vs. Katalog", {
      claudeItems: parsed.items,
      catalogArticleNumbers: beads.map((bead) => bead.article_number),
    });

    function normalizeArticleNumber(value: string): string {
      return value.trim().toLowerCase();
    }

    const beadsByArticleNumber = new Map(
      beads.map((bead) => [normalizeArticleNumber(bead.article_number), bead.id])
    );

    const items = parsed.items
      .filter((item) => item.quantity > 0)
      .map((item) => {
        const beadId = item.article_number
          ? (beadsByArticleNumber.get(
              normalizeArticleNumber(item.article_number)
            ) ?? null)
          : null;
        return {
          bead_id: beadId,
          quantity: item.quantity,
          unknown_description: beadId
            ? null
            : (item.description ?? "Unbekannte Perle"),
        };
      });

    return { ok: true, items };
  } catch (err) {
    logClaudeError("suggestBeadsFromPhoto", err);
    return { ok: false, message: "Perlen-Erkennung ist fehlgeschlagen" };
  }
}
