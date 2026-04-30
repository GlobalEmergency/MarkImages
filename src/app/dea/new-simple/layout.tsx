import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agregar un Desfibrilador (DEA) - DeaMap",
  description:
    "Registra un nuevo desfibrilador en el mapa de DeaMap. Usa tu ubicación, sube fotos y ayuda a salvar vidas en emergencias cardíacas.",
  alternates: {
    canonical: "/dea/new-simple",
  },
  openGraph: {
    title: "Agregar un Desfibrilador (DEA) | DeaMap",
    description:
      "Registra un nuevo desfibrilador en el mapa de DeaMap. Colabora para salvar vidas.",
    url: "/dea/new-simple",
    images: [{ url: "/og-image.png" }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
