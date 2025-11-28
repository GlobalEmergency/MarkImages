"use client";

import { useState } from "react";

import ImageUpload from "./ImageUpload";

export type AedImageType = "FRONT" | "LOCATION" | "ACCESS" | "SIGNAGE" | "CONTEXT" | "PLATE";

interface ImageUploadWithTypeProps {
  label: string;
  value?: { url: string; type: AedImageType } | null;
  onChange: (data: { url: string; type: AedImageType } | null) => void;
  prefix: string;
  required?: boolean;
}

const IMAGE_TYPE_LABELS: Record<AedImageType, string> = {
  FRONT: "Frontal del DEA",
  LOCATION: "Ubicación",
  ACCESS: "Acceso",
  SIGNAGE: "Señalización",
  CONTEXT: "Contexto",
  PLATE: "Placa identificativa",
};

export default function ImageUploadWithType({
  label,
  value,
  onChange,
  prefix,
  required = false,
}: ImageUploadWithTypeProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(value?.url || null);
  const [imageType, setImageType] = useState<AedImageType>(value?.type || "FRONT");

  const handleImageChange = (url: string | null) => {
    setImageUrl(url);
    if (url) {
      onChange({ url, type: imageType });
    } else {
      onChange(null);
    }
  };

  const handleTypeChange = (type: AedImageType) => {
    setImageType(type);
    if (imageUrl) {
      onChange({ url: imageUrl, type });
    }
  };

  return (
    <div className="space-y-3">
      {/* Selector de tipo de imagen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de imagen
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <select
          value={imageType}
          onChange={(e) => handleTypeChange(e.target.value as AedImageType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {Object.entries(IMAGE_TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Upload de imagen */}
      <ImageUpload
        label={label}
        value={imageUrl || undefined}
        onChange={handleImageChange}
        prefix={prefix}
        required={required}
      />
    </div>
  );
}
