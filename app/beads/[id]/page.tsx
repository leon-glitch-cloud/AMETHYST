import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateBead, deleteBead } from "@/app/beads/actions";
import { Field } from "@/app/beads/_components/field";
import { ConfirmFormButton } from "@/app/_components/confirm-form-button";
import { FileUploadField } from "@/app/_components/file-upload-field";
import { ProductSearchButton } from "@/app/_components/product-search-button";
import { BackLink } from "@/app/_components/back-link";
import { SubmitButton } from "@/app/_components/submit-button";

type Bead = {
  id: string;
  article_number: string;
  name: string | null;
  material: string | null;
  image_url: string | null;
  size_mm: number | string | null;
  color: string | null;
  package_price: number | string | null;
  package_quantity: number | string | null;
  unit_price: number | string | null;
  source_shop: string | null;
  source_url: string | null;
};

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 4,
});

async function getBead(id: string): Promise<Bead | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beads")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function BeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { id } = await params;
  const { error, from } = await searchParams;
  const bead = await getBead(id);

  if (!bead) {
    notFound();
  }

  // Nur interne Pfade zulassen (kein "//evil.com"-Open-Redirect-Trick).
  const backHref = from && from.startsWith("/") && !from.startsWith("//") ? from : "/beads";

  const updateBeadWithId = updateBead.bind(null, id);
  const deleteBeadWithId = deleteBead.bind(null, id);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <BackLink href={backHref} />

      <h1 className="mb-6 text-2xl font-medium text-gray-900">
        Perle bearbeiten
      </h1>

      <div className="relative mb-6 flex h-56 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {bead.image_url ? (
          <Image
            src={bead.image_url}
            alt={bead.article_number}
            fill
            className="object-cover"
          />
        ) : (
          <span className="text-sm text-gray-400">Kein Bild</span>
        )}
      </div>

      <div className="mb-6">
        <ProductSearchButton url={bead.source_url} shop={bead.source_shop} />
      </div>

      <form action={updateBeadWithId} className="space-y-4">
        <Field
          label="Artikelnummer"
          name="article_number"
          defaultValue={bead.article_number}
          required
        />
        <Field label="Name" name="name" defaultValue={bead.name ?? undefined} />

        <FileUploadField
          id="photo"
          name="photo"
          label={`Referenzfoto${bead.image_url ? " (ersetzen)" : ""}`}
          buttonLabel={bead.image_url ? "Foto ersetzen" : "Foto hinzufügen"}
          accept="image/*"
        />

        <Field
          label="Größe (mm)"
          name="size_mm"
          type="number"
          step="0.1"
          defaultValue={bead.size_mm ?? undefined}
        />
        <Field label="Farbe" name="color" defaultValue={bead.color ?? undefined} />
        <Field
          label="Material"
          name="material"
          defaultValue={bead.material ?? undefined}
        />
        <Field
          label="Packungspreis (€)"
          name="package_price"
          type="number"
          step="0.01"
          defaultValue={bead.package_price ?? undefined}
        />
        <Field
          label="Packungsmenge (Stk.)"
          name="package_quantity"
          type="number"
          step="1"
          defaultValue={bead.package_quantity ?? 1}
        />
        <p className="text-sm text-gray-500">
          Preis pro Perle: {currencyFormatter.format(Number(bead.unit_price ?? 0))}
        </p>
        <Field
          label="Shop"
          name="source_shop"
          defaultValue={bead.source_shop ?? undefined}
        />
        <Field
          label="Shop-Link"
          name="source_url"
          type="url"
          defaultValue={bead.source_url ?? undefined}
        />

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
          <Link
            href={backHref}
            className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
          >
            Zurück
          </Link>
        </div>
      </form>

      <div className="mt-8 border-t border-gray-200 pt-4">
        <ConfirmFormButton
          action={deleteBeadWithId}
          label="Perle löschen"
          confirmMessage="Diese Perle wirklich löschen?"
        />
      </div>
    </main>
  );
}
