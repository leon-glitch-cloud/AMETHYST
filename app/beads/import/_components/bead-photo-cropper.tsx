"use client";

import { useRef, useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

export type PhotoBbox = { x: number; y: number; width: number; height: number };

function bboxToPercentCrop(bbox: PhotoBbox | null): Crop {
  if (bbox) {
    return {
      unit: "%",
      x: bbox.x * 100,
      y: bbox.y * 100,
      width: bbox.width * 100,
      height: bbox.height * 100,
    };
  }
  return { unit: "%", x: 20, y: 20, width: 60, height: 60 };
}

export function BeadPhotoCropper({
  imageUrl,
  initialBbox,
  onCropped,
  onCancel,
  isSaving = false,
}: {
  imageUrl: string;
  initialBbox: PhotoBbox | null;
  onCropped: (file: File) => void;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>(() => bboxToPercentCrop(initialBbox));
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    const image = imgRef.current;
    if (!image || crop.width <= 0 || crop.height <= 0) return;

    setError(null);

    const cropXPx = (crop.x / 100) * image.width;
    const cropYPx = (crop.y / 100) * image.height;
    const cropWidthPx = (crop.width / 100) * image.width;
    const cropHeightPx = (crop.height / 100) * image.height;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(cropWidthPx * scaleX));
    canvas.height = Math.max(1, Math.round(cropHeightPx * scaleY));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      image,
      cropXPx * scaleX,
      cropYPx * scaleY,
      cropWidthPx * scaleX,
      cropHeightPx * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Zuschnitt konnte nicht erstellt werden");
        return;
      }
      onCropped(new File([blob], "foto.png", { type: "image/png" }));
    }, "image/png");
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Original zum Zuschneiden"
          crossOrigin="anonymous"
          className="max-h-[70vh] w-full object-contain"
        />
      </ReactCrop>

      {error && <p className="mt-2 text-sm text-gray-500">{error}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isSaving}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Speichert…" : "Zuschnitt übernehmen"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
