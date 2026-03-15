"use client";

import { ExternalLink, MapPin, PlusCircle } from "lucide-react";
import Link from "next/link";

import { useAnalytics } from "@/hooks/useAnalytics";

export default function Footer() {
  const { trackNavClick, trackExternalLink } = useAnalytics();

  return (
    <footer className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* DeaMap Info */}
          <div>
            <h3 className="font-bold text-lg mb-3 text-white">DeaMap</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Mapa colaborativo de desfibriladores en España
            </p>
          </div>

          {/* Global Emergency Link */}
          <div>
            <h3 className="font-bold text-lg mb-3 text-white">Proyecto de</h3>
            <a
              href="https://www.globalemergency.online/proyectos/deamap"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors group"
              onClick={() =>
                trackExternalLink(
                  "https://www.globalemergency.online/proyectos/deamap",
                  "Global Emergency (footer)",
                  "footer"
                )
              }
            >
              <span className="font-semibold">Global Emergency</span>
              <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
            <p className="text-gray-400 text-xs mt-2">Mejorando la respuesta ante emergencias</p>
          </div>

          {/* Enlaces rápidos */}
          <div>
            <h3 className="font-bold text-lg mb-3 text-white">Enlaces</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/locations"
                  className="text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1"
                  onClick={() => trackNavClick("Desfibriladores por ciudad (footer)", "/locations")}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Desfibriladores por ciudad
                </Link>
              </li>
              <li>
                <Link
                  href="/dea/new-simple"
                  className="text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1"
                  onClick={() => trackNavClick("Agregar un DEA (footer)", "/dea/new-simple")}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Agregar un DEA
                </Link>
              </li>
              <li>
                <Link
                  href="/api/docs"
                  className="text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1"
                  onClick={() => trackNavClick("API pública (footer)", "/api/docs")}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  API pública
                </Link>
              </li>
              <li>
                <a
                  href="https://www.globalemergency.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1"
                  onClick={() =>
                    trackExternalLink(
                      "https://www.globalemergency.online",
                      "Global Emergency (footer links)",
                      "footer"
                    )
                  }
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Global Emergency
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6 text-sm text-gray-400">
          <div className="flex flex-wrap justify-center gap-4 mb-3">
            <Link href="/legal/privacidad" className="hover:text-white transition-colors">
              Política de Privacidad
            </Link>
            <Link href="/legal/cookies" className="hover:text-white transition-colors">
              Política de Cookies
            </Link>
            <Link href="/legal/condiciones" className="hover:text-white transition-colors">
              Condiciones de Uso
            </Link>
          </div>
          <p className="text-center">© 2024-2026 DeaMap - Salvando vidas juntos</p>
        </div>
      </div>
    </footer>
  );
}
