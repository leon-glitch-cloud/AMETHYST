"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadPublicImage } from "@/lib/supabase/storage";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function beadFieldsFromFormData(formData: FormData) {
  return {
    size_mm: parseNumber(formData.get("size_mm")),
    color: parseText(formData.get("color")),
    unit_price: parseNumber(formData.get("unit_price")) ?? 0,
    source_shop: parseText(formData.get("source_shop")),
    source_url: parseText(formData.get("source_url")),
    stock_count: parseNumber(formData.get("stock_count")) ?? 0,
  };
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
  const { error } = await supabase.from("beads").insert({
    id,
    article_number: articleNumber,
    image_url: imageUrl,
    ...beadFieldsFromFormData(formData),
  });

  if (error) {
    const message =
      error.code === "23505"
        ? "Artikelnummer existiert bereits"
        : "Perle konnte nicht gespeichert werden";
    redirect(`/beads/new?error=${encodeURIComponent(message)}`);
  }

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
  const { error } = await supabase
    .from("beads")
    .update({
      article_number: articleNumber,
      ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
      ...beadFieldsFromFormData(formData),
    })
    .eq("id", id);

  if (error) {
    const message =
      error.code === "23505"
        ? "Artikelnummer existiert bereits"
        : "Perle konnte nicht gespeichert werden";
    redirect(`/beads/${id}?error=${encodeURIComponent(message)}`);
  }

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

  redirect("/beads");
}
