"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadPublicImage } from "@/lib/supabase/storage";
import { parseNumber, parseText } from "@/lib/forms";

function beadFieldsFromFormData(formData: FormData) {
  return {
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
  const { error } = await supabase.from("beads").insert({
    id,
    article_number: articleNumber,
    image_url: imageUrl,
    ...beadFieldsFromFormData(formData),
  });

  if (error) {
    redirect(
      `/beads/new?error=${encodeURIComponent(beadErrorMessage(error))}`
    );
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
    redirect(
      `/beads/${id}?error=${encodeURIComponent(beadErrorMessage(error))}`
    );
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
