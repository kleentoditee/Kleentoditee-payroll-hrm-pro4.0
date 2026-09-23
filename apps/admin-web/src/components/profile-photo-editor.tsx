"use client";

import Cropper, { type Area, type Point } from "react-easy-crop";
import { useEffect, useState } from "react";

type Props = {
  employeeName: string;
  file: File;
  onCancel: () => void;
  onSave: (file: File) => Promise<boolean>;
};

const OUTPUT_SIZE = 512;

async function createCroppedPhoto(imageUrl: string, crop: Area): Promise<File> {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Photo editor is not available in this browser.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not prepare the cropped photo."))),
      "image/jpeg",
      0.9
    );
  });
  return new File([blob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" });
}

export function ProfilePhotoEditor({ employeeName, file, onCancel, onSave }: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setImageLoaded(false);
    setCroppedArea(null);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  async function savePhoto() {
    if (!croppedArea) return;
    setSaving(true);
    setError(null);
    try {
      const output = await createCroppedPhoto(imageUrl, croppedArea);
      const saved = await onSave(output);
      if (!saved) {
        setError("The photo could not be uploaded. Please try again.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The photo could not be prepared.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-editor-title"
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="photo-editor-title" className="font-semibold text-slate-900">Position profile photo</h2>
            <p className="text-sm text-slate-500">{employeeName || "Employee"}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            Close
          </button>
        </div>

        <div className="relative h-80 bg-slate-950 sm:h-96">
          {!imageLoaded ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm font-medium text-white">
              Loading photo...
            </div>
          ) : null}
          {imageUrl ? (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              minZoom={1}
              maxZoom={4}
              zoomSpeed={0.15}
              onMediaLoaded={() => setImageLoaded(true)}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCroppedArea(pixels)}
            />
          ) : null}
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm font-medium text-slate-700">
            Zoom
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-2 w-full accent-brand"
            />
          </label>
          <p className="text-sm text-slate-600">Drag the photo to position it inside the circle.</p>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => void savePhoto()} disabled={saving || !imageLoaded || !croppedArea} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:opacity-50">
              {saving ? "Saving..." : "Save photo"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
