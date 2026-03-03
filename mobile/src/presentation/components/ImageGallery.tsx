import React from "react";
import { IonIcon } from "@ionic/react";
import { imageOutline } from "ionicons/icons";

import { AedImage } from "../../domain/models/Aed";

interface ImageGalleryProps {
  images: AedImage[];
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  if (!images || images.length === 0) {
    return (
      <div
        style={{
          height: 200,
          background: "var(--ion-color-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 8,
          color: "var(--ion-color-medium)",
        }}
      >
        <IonIcon icon={imageOutline} style={{ fontSize: 48 }} />
        <span style={{ fontSize: 14 }}>Sin imágenes</span>
      </div>
    );
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
          alt={img.type}
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
