"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadPublicImage } from "@/lib/supabase/storage";
import { parseNumber, parseText } from "@/lib/forms";
import { productSearchUrl } from "@/lib/beads";

// Der Shop-Link wird beim Anlegen/Import automatisch aus Shop + Artikelnummer
// erzeugt (Google-Suche). Damit ein späteres Ändern des Shop-Feldes nicht zu
// einem inkonsistenten Button führt ("Bei X ansehen", sucht aber nach Y),
// wird der Link neu erzeugt, solange er noch diese automatisch generierte
// Such-URL ist und nicht manuell durch einen eigenen Link ersetzt wurde.
function isAutoSearchUrl(url: string | null): boolean {
  return !url || url.startsWith("https://www.google.com/search?q=");
}

function beadFieldsFromFormData(formData: FormData) {
  return {
    name: parseText(formData.get("name")),
    material: parseText(formData.get("material")),
    size_mm: parseNumber(formData.get("size_mm")),
    color: parseText(formData.get("color")),
    package_price: parseNumber(formData.get("package_price")) ?? 0,
    package_quantity: parseNumber(formData.get("package_quantity")) ?? 1,
    source_shop: parseText(formData.get("source_shop")),
    source_url: parseText(formData.get("source_url")),
  };
}

function beadErrorMessage(error: { code?: string }): string {
  if (error.code === "23505") return "Artikelnummer existiert bereits";
  if (error.code === "23514") return "Packungsmenge muss größer als 0 sein";
  return "Perle konnte nicht gespeichert werden";
}

export async function createBead(formData: FormData) {
  const articleNumber = parseText(formData.get("article_number"));
  if (!articleNumber) {
    redirect(
      `/beads/new?error=${encodeURIComponent("Artikelnummer ist erforderlich")}`
    );
  }

  const id = crypto.randomUUID();
  let imageUrl: string | null = null;

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      imageUrl = await uploadPublicImage("bead-photos", `${id}/${photo.name}`, photo);
    } catch {
      redirect(
        `/beads/new?error=${encodeURIComponent("Foto-Upload fehlgeschlagen")}`
      );
    }
  }

  const supabase = createSupabaseServerClient();
  const fields = beadFieldsFromFormData(formData);
  if (!fields.source_url) {
    fields.source_url = productSearchUrl(articleNumber, fields.source_shop);
  }

  const { error } = await supabase.from("beads").insert({
    id,
    article_number: articleNumber,
    image_url: imageUrl,
    ...fields,
  });

  if (error) {
    redirect(
      `/beads/new?error=${encodeURIComponent(beadErrorMessage(error))}`
    );
  }

  revalidatePath("/beads");
  redirect("/beads");
}

export async function updateBead(id: string, formData: FormData) {
  const articleNumber = parseText(formData.get("article_number"));
  if (!articleNumber) {
    redirect(
      `/beads/${id}?error=${encodeURIComponent("Artikelnummer ist erforderlich")}`
    );
  }

  let imageUrl: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      imageUrl = await uploadPublicImage("bead-photos", `${id}/${photo.name}`, photo);
    } catch {
      redirect(
        `/beads/${id}?error=${encodeURIComponent("Foto-Upload fehlgeschlagen")}`
      );
    }
  }

  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("beads")
    .select("source_url")
    .eq("id", id)
    .maybeSingle();

  const fields = beadFieldsFromFormData(formData);
  if (
    isAutoSearchUrl(existing?.source_url ?? null) &&
    fields.source_url === (existing?.source_url ?? null)
  ) {
    fields.source_url = productSearchUrl(articleNumber, fields.source_shop);
  }

  const { error } = await supabase
    .from("beads")
    .update({
      article_number: articleNumber,
      ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
      ...fields,
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/beads/${id}?error=${encodeURIComponent(beadErrorMessage(error))}`
    );
  }

  revalidatePath("/beads");
  redirect("/beads");
}

export async function deleteBead(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("beads").delete().eq("id", id);

  if (error) {
    const message =
      error.code === "23503"
        ? "Perle wird noch verwendet (Armband oder Rückversand) und kann nicht gelöscht werden"
        : "Perle konnte nicht gelöscht werden";
    redirect(`/beads/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/beads");
  redirect("/beads");
}
