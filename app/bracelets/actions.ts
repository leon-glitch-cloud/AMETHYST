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
