"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadPrivateFile } from "@/lib/supabase/storage";
import { parseNumber, parseText } from "@/lib/forms";
import { createClaudeClient, logClaudeError, toImageMediaType } from "@/lib/claude";
import { productSearchUrl } from "@/lib/beads";

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
          name: { type: ["string", "null"] },
          material: { type: ["string", "null"] },
          color: { type: ["string", "null"] },
          size_mm: { type: ["number", "null"] },
          package_price: { type: ["number", "null"] },
          shop: { type: ["string", "null"] },
          package_quantity: { type: "integer" },
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
              text: "Hier ist eine Bestellbestätigung/Materialliste für Perlen-Nachschub. Lies pro Position aus: Artikelnummer, Name/Bezeichnung der Perle (z. B. \"Donut\"), Material (z. B. \"Edelstahl vg.\"), Farbe, Größe (mm), Shop/Händler (falls erkennbar), den Packungspreis (was diese Packung/dieser Strang gekostet hat) und die Packungsmenge (wie viele Perlen darin enthalten sind, z. B. Perlen pro Strang). Falls ein Wert nicht erkennbar ist, das jeweilige Feld leer lassen (null), nichts raten. Antworte ausschließlich mit dem geforderten JSON.",
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
  // Fotos werden stattdessen manuell über den "Foto hinzufügen"-Button an der
  // Perle ergänzt, ggf. mithilfe des automatisch erzeugten Shop-Suchlinks.

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
