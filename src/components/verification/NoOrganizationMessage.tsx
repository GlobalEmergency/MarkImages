"use client";

import { AlertCircle, Building2, Mail } from "lucide-react";

export default function NoOrganizationMessage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <Building2 className="w-16 h-16 text-amber-300" />
              <AlertCircle className="w-8 h-8 text-amber-600 absolute -bottom-1 -right-1" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">Sin Acceso a Verificaciones</h2>

          <p className="text-gray-700 mb-6">
            No perteneces a ninguna organización con permisos de verificación de DEAs.
          </p>

          <div className="bg-white border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Para acceder necesitas:</h3>
            <ul className="text-sm text-gray-700 space-y-2 text-left">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Ser miembro de una organización (ej: Protección Civil)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Tener permisos de verificación activados</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Que la organización tenga DEAs asignados</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <a
              href="mailto:admin@deamap.es"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
            >
              <Mail className="w-5 h-5" />
              Contactar con Administrador
            </a>

            <div>
              <a
                href="/"
                className="text-sm text-amber-700 hover:text-amber-800 font-medium underline"
              >
                Volver al inicio
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
