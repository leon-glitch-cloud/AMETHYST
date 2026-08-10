"use client";

import { useState } from "react";
import { FileUploadField } from "@/app/_components/file-upload-field";
import { BraceletNameField } from "@/app/bracelets/_components/bracelet-name-field";

export function BraceletBasicsFields({
  defaultName,
  photoFieldLabelSuffix = "",
}: {
  defaultName?: string;
  photoFieldLabelSuffix?: string;
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  return (
    <>
      <BraceletNameField defaultValue={defaultName} photoFile={photoFile} />

      <FileUploadField
        id="photo"
        name="photo"
        label={`Foto${photoFieldLabelSuffix}`}
        buttonLabel={photoFieldLabelSuffix ? "Foto ersetzen" : "Foto hinzufügen"}
        accept="image/*"
        onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
      />
    </>
  );
}
