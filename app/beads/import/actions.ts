"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadPrivateFile, uploadPublicImage } from "@/lib/supabase/storage";
import { parseNumber, parseText } from "@/lib/forms";
import { createClaudeClient, toImageMediaType } from "@/lib/claude";

type ExtractedItem = {
  article_number: string;
  color: string | null;
  size_mm: number | null;
  unit_price: number | null;
  shop: string | null;
  quantity: number;
  image_url: string | null;
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
          color: { type: ["string", "null"] },
          size_mm: { type: ["number", "null"] },
          unit_price: { type: ["number", "null"] },
          shop: { type: ["string", "null"] },
          quantity: { type: "integer" },
        },
        required: [
          "article_number",
          "color",
          "size_mm",
          "unit_price",
          "shop",
          "quantity",
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
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: {
        format: { type: "json_schema", schema: MATERIAL_ORDER_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hier ist eine Bestellbestätigung/Materialliste für Perlen-Nachschub. Lies alle Positionen aus: Artikelnummer, Farbe, Größe (mm), Einzelpreis, Shop/Händler (falls erkennbar) und bestellte Menge. Antworte ausschließlich mit dem geforderten JSON.",
            },
            fileBlock,
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("refusal");
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("no-text");
    }

    const parsed = JSON.parse(textBlock.text) as {
      items: Omit<ExtractedItem, "image_url">[];
    };
    items = parsed.items.map((item) => ({ ...item, image_url: null }));
  } catch {
    redirect(
      `/beads/import?error=${encodeURIComponent(
        "Bestellliste konnte nicht analysiert werden"
      )}`
    );
  }

  // Bilder aus der Datei ausschneiden (falls vorhanden) — rein optional,
  // schlägt dieser Block fehl, bleiben die image_url-Felder einfach leer.
  try {
    const articleNumbers = items.map((item) => item.article_number);
    if (articleNumbers.length > 0) {
      const client = createClaudeClient();
      const uploaded = await client.beta.files.upload({
        file,
        betas: ["files-api-2025-04-14"],
      });

      const codeResponse = await client.messages.create(
        {
          model: "claude-opus-5",
          max_tokens: 4096,
          tools: [{ type: "code_execution_20260521", name: "code_execution" }],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Die angehängte Datei ist eine Bestellbestätigung/Materialliste für folgende Artikelnummern: ${articleNumbers.join(
                    ", "
                  )}. Prüfe, ob zu einzelnen Artikelnummern ein Produktfoto in der Datei enthalten ist. Falls ja, schneide es aus und speichere es exakt als "<Artikelnummer>.png" (z. B. "${articleNumbers[0]}.png"). Erstelle keine Datei für Artikelnummern ohne erkennbares Foto.`,
                },
                { type: "container_upload", file_id: uploaded.id },
              ],
            },
          ],
        },
        { headers: { "anthropic-beta": "files-api-2025-04-14" } }
      );

      const itemsByArticleNumber = new Map(
        items.map((item) => [item.article_number.toLowerCase(), item])
      );

      for (const block of codeResponse.content as Array<{
        type: string;
        content?: unknown;
      }>) {
        if (block.type !== "bash_code_execution_tool_result") continue;

        const result = block.content as
          | { type: string; content?: Array<{ type: string; file_id?: string }> }
          | undefined;
        if (
          !result ||
          result.type !== "bash_code_execution_result" ||
          !result.content
        ) {
          continue;
        }

        for (const fileRef of result.content) {
          if (fileRef.type !== "bash_code_execution_output" || !fileRef.file_id) {
            continue;
          }

          const metadata = await client.beta.files.retrieveMetadata(
            fileRef.file_id
          );
          const baseName = metadata.filename
            .replace(/\.[^.]+$/, "")
            .toLowerCase();
          const matchedItem = itemsByArticleNumber.get(baseName);
          if (!matchedItem) continue;

          const downloadResponse = await client.beta.files.download(
            fileRef.file_id
          );
          const imageBytes = await downloadResponse.arrayBuffer();
          const imageFile = new File([imageBytes], metadata.filename, {
            type: "image/png",
          });
          const imageUrl = await uploadPublicImage(
            "bead-photos",
            `${matchedItem.article_number}/${metadata.filename}`,
            imageFile
          );
          matchedItem.image_url = imageUrl;
        }
      }
    }
  } catch {
    // Bild-Erkennung ist optional, Rest des Flows läuft unverändert weiter.
  }

  const id = crypto.randomUUID();
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
    extracted_json: { items },
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

type MaterialOrderRow = {
  article_number: string;
  color: string | null;
  size_mm: number | null;
  unit_price: number | null;
  source_shop: string | null;
  quantity: number;
  image_url: string | null;
};

function parseMaterialOrderRows(formData: FormData): MaterialOrderRow[] {
  const articleNumbers = formData.getAll("article_number");
  const colors = formData.getAll("color");
  const sizes = formData.getAll("size_mm");
  const prices = formData.getAll("unit_price");
  const shops = formData.getAll("source_shop");
  const quantities = formData.getAll("quantity");
  const imageUrls = formData.getAll("image_url");

  const rows: MaterialOrderRow[] = [];

  articleNumbers.forEach((raw, index) => {
    const articleNumber = parseText(raw);
    if (!articleNumber) return;
    const quantity = parseNumber(quantities[index] ?? null);
    if (!quantity || quantity <= 0) return;

    rows.push({
      article_number: articleNumber,
      image_url: parseText(imageUrls[index] ?? null),
      color: parseText(colors[index] ?? null),
      size_mm: parseNumber(sizes[index] ?? null),
      unit_price: parseNumber(prices[index] ?? null),
      source_shop: parseText(shops[index] ?? null),
      quantity,
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
      .select("id, stock_count")
      .eq("article_number", row.article_number)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("beads")
        .update({ stock_count: existing.stock_count + row.quantity })
        .eq("id", existing.id);
    } else {
      await supabase.from("beads").insert({
        id: crypto.randomUUID(),
        article_number: row.article_number,
        color: row.color,
        size_mm: row.size_mm,
        unit_price: row.unit_price ?? 0,
        source_shop: row.source_shop,
        stock_count: row.quantity,
        image_url: row.image_url,
      });
    }
  }

  const total = rows.reduce(
    (sum, row) => sum + row.quantity * (row.unit_price ?? 0),
    0
  );

  const { error: transactionError } = await supabase
    .from("transactions")
    .insert({
      date: new Date().toISOString().slice(0, 10),
      type: "expense",
      description: `Materialbestellung (${rows.length} Position${
        rows.length === 1 ? "" : "en"
      })`,
      amount: -Math.abs(total),
    });

  if (transactionError) {
    redirect(
      `/beads/import/${materialOrderId}?error=${encodeURIComponent(
        "Ausgabe konnte nicht gebucht werden"
      )}`
    );
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

  redirect("/beads");
}
