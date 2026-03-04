import React from "react";

import { AedImage, AedImageType } from "../../domain/models/Aed";

const IMAGE_TYPE_LABELS: Record<AedImageType, string> = {
  FRONT: "Vista frontal del DEA",
  LOCATION: "Ubicación del DEA",
  ACCESS: "Acceso al DEA",
  SIGNAGE: "Señalización del DEA",
  CONTEXT: "Entorno del DEA",
  PLATE: "Placa del DEA",
};

const ImageGallery: React.FC<{ images: AedImage[] }> = ({ images }) => {
  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        overflowX: "auto",
        gap: 4,
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {images.map((img) => (
        <img
          key={img.id}
          src={img.processed_url || img.original_url}
          alt={IMAGE_TYPE_LABELS[img.type] || img.type}
          style={{
            width: images.length === 1 ? "100%" : "85%",
            height: 220,
            objectFit: "cover",
            flexShrink: 0,
            scrollSnapAlign: "start",
            borderRadius: 0,
          }}
        />
      ))}
    </div>
  );
};

export default ImageGallery;
