import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function uploadPublicImage(
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

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
