import { Heart, Home, MapPin, PlusCircle, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <Heart className="h-20 w-20 text-red-500 mx-auto mb-4" />
          <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Página no encontrada</h2>
          <p className="text-gray-600">
            Lo sentimos, la página que buscas no existe. Pero puedes encontrar un desfibrilador
            cercano o explorar nuestro mapa.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Home className="w-5 h-5 mr-2" />
            Ir al mapa
          </Link>

          <Link
            href="/locations"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            <Search className="w-5 h-5 mr-2" />
            Buscar desfibriladores por ciudad
          </Link>

          <Link
            href="/dea/new-simple"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-white text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors font-medium"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Agregar un desfibrilador
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>
            <MapPin className="w-4 h-4 inline mr-1" />
            DeaMap - Mapa de desfibriladores en España
          </p>
        </div>
      </div>
    </div>
  );
}
