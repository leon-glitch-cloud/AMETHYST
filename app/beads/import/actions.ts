"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadPrivateFile, uploadPublicImage } from "@/lib/supabase/storage";
import { parseNumber, parseText } from "@/lib/forms";
import { createClaudeClient, logClaudeError, toImageMediaType } from "@/lib/claude";
import { productSearchUrl } from "@/lib/beads";

type PhotoBbox = { x: number; y: number; width: number; height: number };

type ExtractedItem = {
  article_number: string;
  name: string | null;
  material: string | null;
  color: string | null;
  size_mm: number | null;
  package_price: number | null;
  shop: string | null;
  package_quantity: number;
  image_url: string | null;
  photo_bbox: PhotoBbox | null;
};

const MATERIAL_ORDER_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          article_number: { type: "string" },
          name: {
            type: ["string", "null"],
            description:
              'Perlenname zweisprachig, Format "Englisch / Deutsch", z. B. "Bloodstone (Heliotrope) / Blutjaspis (Heliotrop)" oder "Donut / Donut", falls der Name in beiden Sprachen gleich ist. Falls kein Name erkennbar ist, null.',
          },
          material: { type: ["string", "null"] },
          color: {
            type: ["string", "null"],
            description:
              "Nur Basisfarben: rot, gelb, blau, grün, violett, orange, weiß, schwarz, rosa, braun, grau, gold, silber. Bei Mischtönen/Fantasienamen (z. B. \"Honig Cognac\", \"Bernstein\") die passende(n) Basisfarbe(n) kommagetrennt eintragen, keine Fantasie-/Markennamen übernehmen. Metallische Perlen (z. B. goldfarbenes oder silberfarbenes Edelstahl/Metall) als \"gold\" bzw. \"silber\" einordnen, nicht als \"gelb\" oder \"grau\".",
          },
          size_mm: { type: ["number", "null"] },
          package_price: { type: ["number", "null"] },
          shop: { type: ["string", "null"] },
          package_quantity: { type: "integer" },
          photo_bbox: {
            type: ["object", "null"],
            description:
              "Nur falls die hochgeladene Datei ein Bild mit einem klar erkennbaren Produktfoto der Perle ist (z. B. Screenshot einer Shop-Seite): möglichst eng geschätzte Position NUR des Fotos selbst, als Anteile 0–1 der Gesamtbildgröße. Lieber zu knapp als zu großzügig — kein Rand, kein Hintergrund, kein Text/UI darf enthalten sein, auch nicht angeschnitten. Sonst null.",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["x", "y", "width", "height"],
            additionalProperties: false,
          },
        },
        required: [
          "article_number",
          "name",
          "material",
          "color",
          "size_mm",
          "package_price",
          "shop",
          "package_quantity",
          "photo_bbox",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

type MaterialOrderContentBlock =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: {
        type: "base64";
        media_type: "application/pdf";
        data: string;
      };
    }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: ReturnType<typeof toImageMediaType>;
        data: string;
      };
    };

export async function createMaterialOrderUpload(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/beads/import?error=${encodeURIComponent("Bitte zuerst eine Datei auswählen")}`
    );
  }

  const mimeType = file.type;
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  if (!isPdf && !isImage) {
    redirect(
      `/beads/import?error=${encodeURIComponent(
        "Nicht unterstütztes Dateiformat (PDF oder Bild erwartet)"
      )}`
    );
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const fileBlock: MaterialOrderContentBlock = isPdf
    ? {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type: toImageMediaType(mimeType),
          data: base64,
        },
      };

  let items: ExtractedItem[] = [];

  try {
    const client = createClaudeClient();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      thinking: { type: "disabled" },
      output_config: {
        format: { type: "json_schema", schema: MATERIAL_ORDER_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Hier ist eine Bestellbestätigung/Materialliste für Perlen-Nachschub. Lies pro Position aus: Artikelnummer, Name/Bezeichnung der Perle, Material (z. B. "Edelstahl vg."), Größe (mm), Shop/Händler (falls erkennbar), den Packungspreis (was diese Packung/dieser Strang gekostet hat) und die Packungsmenge (wie viele Perlen darin enthalten sind, z. B. Perlen pro Strang). Falls ein Wert nicht erkennbar ist, das jeweilige Feld leer lassen (null), nichts raten.\n\nName: gib den Perlennamen zweisprachig an, Format "Englisch / Deutsch", z. B. "Bloodstone (Heliotrope) / Blutjaspis (Heliotrop)" oder "Donut / Donut". Übersetze dabei fachlich korrekt (z. B. Mineral-/Edelsteinnamen), nicht wörtlich.\n\nFarbe: schreibe NUR eine oder mehrere dieser Basisfarben, kommagetrennt, keine Fantasie- oder Produktnamen: rot, gelb, blau, grün, violett, orange, weiß, schwarz, rosa, braun, grau, gold, silber. Übersetze Fantasienamen in die passende(n) Basisfarbe(n), z. B. "Honig Cognac" → "orange", "Bernstein" → "orange,gelb". Metallisch goldfarbene oder silberfarbene Perlen (z. B. Edelstahl vergoldet/versilbert) bitte als "gold" bzw. "silber" einordnen, nicht als "gelb" oder "grau".\n\nphoto_bbox: falls die Datei ein Bild mit einem klar erkennbaren Produktfoto der Perle ist, gib zusätzlich die Position NUR dieses Fotos an (x/y = linke obere Ecke, width/height = Breite/Höhe, jeweils als Anteil 0–1 der Gesamtbildgröße). Schätze die Box so eng wie möglich um das Foto herum — lieber etwas zu knapp (kleiner) als zu großzügig. Kein Rand, kein Hintergrund, keine Artikelnummer/Preis/Beschreibung/Buttons dürfen in der Box enthalten sein, auch nicht teilweise (z. B. keine angeschnittene Textzeile am unteren Rand der Box). Bei mehreren Fotos in einem Bild jeder Position ihr eigenes Foto zuordnen. Falls kein eindeutiges Produktfoto erkennbar ist oder die Datei kein Bild ist, photo_bbox auf null setzen.\n\nAntworte ausschließlich mit dem geforderten JSON.',
            },
            fileBlock,
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      console.error(
        "[createMaterialOrderUpload] Claude hat die Analyse verweigert (stop_reason=refusal)",
        { content: response.content }
      );
      throw new Error("refusal");
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error(
        "[createMaterialOrderUpload] Keine Text-Antwort im Claude-Response enthalten",
        { stop_reason: response.stop_reason, content: response.content }
      );
      throw new Error("no-text");
    }

    const parsed = JSON.parse(textBlock.text) as {
      items: Omit<ExtractedItem, "image_url">[];
    };
    items = parsed.items.map((item) => ({ ...item, image_url: null }));
  } catch (err) {
    if (
      !(err instanceof Error) ||
      (err.message !== "refusal" && err.message !== "no-text")
    ) {
      logClaudeError("createMaterialOrderUpload", err);
    }
    redirect(
      `/beads/import?error=${encodeURIComponent(
        "Bestellliste konnte nicht analysiert werden"
      )}`
    );
  }

  // Automatisches Bild-Ausschneiden per Code-Execution-Tool wurde entfernt
  // (zweiter voller Modell-Aufruf mit erneuter Datei-Übertragung war teuer).
  // Stattdessen liefert die ohnehin schon bezahlte Text-Extraktion oben
  // pro Position eine Bounding-Box fürs Produktfoto mit, die hier lokal
  // per sharp zugeschnitten wird — kein zweiter KI-Aufruf nötig. Das
  // Original-Bild wird zusätzlich öffentlich hochgeladen, damit der
  // Zuschnitt im Prüfformular manuell nachjustiert werden kann.
  const id = crypto.randomUUID();
  let originalImageUrl: string | null = null;

  if (isImage) {
    try {
      originalImageUrl = await uploadPublicImage(
        "bead-photos",
        `${id}/original-${file.name}`,
        file
      );
    } catch (err) {
      logClaudeError("createMaterialOrderUpload:original-upload", err);
    }

    try {
      const sourceImage = sharp(Buffer.from(bytes));
      const metadata = await sourceImage.metadata();
      const imgWidth = metadata.width ?? 0;
      const imgHeight = metadata.height ?? 0;

      if (imgWidth > 0 && imgHeight > 0) {
        for (let i = 0; i < items.length; i++) {
          const bbox = items[i].photo_bbox;
          if (!bbox) continue;

          const left = Math.max(0, Math.round(bbox.x * imgWidth));
          const top = Math.max(0, Math.round(bbox.y * imgHeight));
          const width = Math.min(
            imgWidth - left,
            Math.round(bbox.width * imgWidth)
          );
          const height = Math.min(
            imgHeight - top,
            Math.round(bbox.height * imgHeight)
          );
          if (width <= 0 || height <= 0) continue;

          try {
            const croppedBuffer = await sharp(Buffer.from(bytes))
              .extract({ left, top, width, height })
              .png()
              .toBuffer();
            const croppedFile = new File(
              [new Uint8Array(croppedBuffer)],
              `${items[i].article_number || i}.png`,
              { type: "image/png" }
            );
            const imageUrl = await uploadPublicImage(
              "bead-photos",
              `${id}/${croppedFile.name}`,
              croppedFile
            );
            items[i].image_url = imageUrl;
          } catch (err) {
            logClaudeError("createMaterialOrderUpload:crop-item", err);
          }
        }
      }
    } catch (err) {
      // Bild-Zuschnitt ist optional, Rest des Flows läuft unverändert weiter.
      logClaudeError("createMaterialOrderUpload:crop", err);
    }
  }

  const extension = file.name.split(".").pop() || (isPdf ? "pdf" : "jpg");
  const filePath = `${id}/bestellung.${extension}`;

  try {
    await uploadPrivateFile("material-order-uploads", filePath, file);
  } catch {
    redirect(
      `/beads/import?error=${encodeURIComponent("Datei-Upload fehlgeschlagen")}`
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("material_orders").insert({
    id,
    file_url: filePath,
    extracted_json: { items, original_image_url: originalImageUrl },
    status: "pending",
  });

  if (error) {
    redirect(
      `/beads/import?error=${encodeURIComponent(
        "Bestellliste konnte nicht gespeichert werden"
      )}`
    );
  }

  redirect(`/beads/import/${id}`);
}

export async function uploadCroppedBeadPhoto(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, message: "Kein zugeschnittenes Bild erhalten" };
  }

  try {
    const url = await uploadPublicImage(
      "bead-photos",
      `${crypto.randomUUID()}/${photo.name}`,
      photo
    );
    return { ok: true, url };
  } catch (err) {
    logClaudeError("uploadCroppedBeadPhoto", err);
    return { ok: false, message: "Foto konnte nicht gespeichert werden" };
  }
}

type MaterialOrderRow = {
  article_number: string;
  name: string | null;
  material: string | null;
  color: string | null;
  size_mm: number | null;
  package_price: number | null;
  source_shop: string | null;
  package_quantity: number;
  image_url: string | null;
};

function parseMaterialOrderRows(formData: FormData): MaterialOrderRow[] {
  const articleNumbers = formData.getAll("article_number");
  const names = formData.getAll("name");
  const materials = formData.getAll("material");
  const colors = formData.getAll("color");
  const sizes = formData.getAll("size_mm");
  const prices = formData.getAll("package_price");
  const shops = formData.getAll("source_shop");
  const quantities = formData.getAll("package_quantity");
  const imageUrls = formData.getAll("image_url");

  const rows: MaterialOrderRow[] = [];

  articleNumbers.forEach((raw, index) => {
    const articleNumber = parseText(raw);
    if (!articleNumber) return;
    const packageQuantity = parseNumber(quantities[index] ?? null) ?? 1;
    if (packageQuantity <= 0) return;

    rows.push({
      article_number: articleNumber,
      image_url: parseText(imageUrls[index] ?? null),
      name: parseText(names[index] ?? null),
      material: parseText(materials[index] ?? null),
      color: parseText(colors[index] ?? null),
      size_mm: parseNumber(sizes[index] ?? null),
      package_price: parseNumber(prices[index] ?? null),
      source_shop: parseText(shops[index] ?? null),
      package_quantity: packageQuantity,
    });
  });

  return rows;
}

export async function confirmMaterialOrder(
  materialOrderId: string,
  formData: FormData
) {
  const rows = parseMaterialOrderRows(formData);
  if (rows.length === 0) {
    redirect(
      `/beads/import/${materialOrderId}?error=${encodeURIComponent(
        "Mindestens eine Position mit Artikelnummer und Menge angeben"
      )}`
    );
  }

  const supabase = createSupabaseServerClient();

  for (const row of rows) {
    const { data: existing } = await supabase
      .from("beads")
      .select("id, source_url")
      .eq("article_number", row.article_number)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("beads")
        .update({
          package_price: row.package_price ?? 0,
          package_quantity: row.package_quantity,
          ...(existing.source_url
            ? {}
            : {
                source_url: productSearchUrl(
                  row.article_number,
                  row.source_shop
                ),
              }),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("beads").insert({
        id: crypto.randomUUID(),
        article_number: row.article_number,
        name: row.name,
        material: row.material,
        color: row.color,
        size_mm: row.size_mm,
        package_price: row.package_price ?? 0,
        package_quantity: row.package_quantity,
        source_shop: row.source_shop,
        source_url: productSearchUrl(row.article_number, row.source_shop),
        image_url: row.image_url,
      });
    }
  }

  if (formData.get("book_expense") === "yes") {
    const total = rows.reduce((sum, row) => sum + (row.package_price ?? 0), 0);

    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        date: new Date().toISOString().slice(0, 10),
        type: "expense",
        description: `Materialbestellung (${rows.length} Position${
          rows.length === 1 ? "" : "en"
        })`,
        amount: -Math.abs(total),
        person: parseText(formData.get("person")),
      });

    if (transactionError) {
      redirect(
        `/beads/import/${materialOrderId}?error=${encodeURIComponent(
          "Ausgabe konnte nicht gebucht werden"
        )}`
      );
    }
  }

  const { error: statusError } = await supabase
    .from("material_orders")
    .update({ status: "confirmed" })
    .eq("id", materialOrderId);

  if (statusError) {
    redirect(
      `/beads/import/${materialOrderId}?error=${encodeURIComponent(
        "Status konnte nicht aktualisiert werden"
      )}`
    );
  }

  revalidatePath("/beads");
  revalidatePath("/");
  redirect("/beads");
}
