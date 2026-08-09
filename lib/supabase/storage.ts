import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Anthropic lehnt Anfragen mit mehreren Bildern ab, sobald eins davon eine
// Kante über 2000px hat ("many-image requests" limit) — Referenzfotos und
// Armbandfotos werden deshalb schon beim Upload verkleinert, nicht erst
// wenn sie in einer KI-Anfrage landen.
const MAX_IMAGE_DIMENSION = 1568;

async function resizeIfImage(
  file: File
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bytes = await file.arrayBuffer();
    const buffer = await sharp(Buffer.from(bytes))
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();
    return { buffer, contentType: file.type };
  } catch {
    return null;
  }
}

export async function uploadPublicImage(
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const supabase = createSupabaseServerClient();
  const resized = await resizeIfImage(file);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, resized ? resized.buffer : file, {
      upsert: true,
      contentType: (resized?.contentType ?? file.type) || undefined,
    });
  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadPrivateFile(
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) {
    throw error;
  }

  return path;
}
