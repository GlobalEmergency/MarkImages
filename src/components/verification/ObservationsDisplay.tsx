"use client";

import { AlertTriangle, Clock, Key, Info } from "lucide-react";
import { parseObservations, getOtherFields, formatFieldName } from "@/utils/parseObservations";

interface ObservationsDisplayProps {
  observations: string | null | undefined;
  title?: string;
  icon?: React.ReactNode;
}

export default function ObservationsDisplay({
  observations,
  title = "Observaciones del Usuario",
  icon,
}: ObservationsDisplayProps) {
  const parsed = parseObservations(observations);

  // If no observations, don't render anything
  if (!observations) {
    return null;
  }

  // Plain text fallback
  if (!parsed.isJson || !parsed.data) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          {icon || <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{parsed.rawText}</p>
          </div>
        </div>
      </div>
    );
  }

  // Structured JSON display
  const { data } = parsed;
  const otherFields = getOtherFields(data);
  const hasOtherFields = Object.keys(otherFields).length > 0;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        {icon || <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />}
        <div className="flex-1 space-y-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>

          {/* General Information */}
          {(data.provisionalNumber ||
            data.establishmentType ||
            data.localOwnership ||
            data.ownership ||
            data.localUse ||
            data.entrance) && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-amber-800 flex items-center">
                <Info className="w-4 h-4 mr-1.5" />
                Información General
              </h4>
              <div className="ml-5 space-y-1 text-sm text-gray-700">
                {data.provisionalNumber && (
                  <p>
                    <strong>Número Provisional:</strong> {data.provisionalNumber}
                  </p>
                )}
                {data.establishmentType && (
                  <p>
                    <strong>Tipo de Establecimiento:</strong> {data.establishmentType}
                  </p>
                )}
                {data.localOwnership && (
                  <p>
                    <strong>Propiedad Local:</strong> {data.localOwnership}
                  </p>
                )}
                {data.ownership && (
                  <p>
                    <strong>Titularidad:</strong> {data.ownership}
                  </p>
                )}
                {data.localUse && (
                  <p>
                    <strong>Uso Local:</strong> {data.localUse}
                  </p>
                )}
                {data.entrance && (
                  <p>
                    <strong>Entrada:</strong> {data.entrance}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Schedule */}
          {data.scheduleDescription && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-amber-800 flex items-center">
                <Clock className="w-4 h-4 mr-1.5" />
                Horarios
              </h4>
              <div className="ml-5 text-sm text-gray-700">
                <p>{data.scheduleDescription}</p>
              </div>
            </div>
          )}

          {/* Access */}
          {data.accessDescription && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-amber-800 flex items-center">
                <Key className="w-4 h-4 mr-1.5" />
                Descripción de Acceso
              </h4>
              <div className="ml-5 text-sm text-gray-700">
                <p className="whitespace-pre-wrap">{data.accessDescription}</p>
              </div>
            </div>
          )}

          {/* Other Fields */}
          {hasOtherFields && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-amber-800">Información Adicional</h4>
              <div className="ml-5 space-y-1 text-sm text-gray-700">
                {Object.entries(otherFields).map(([key, value]) => (
                  <p key={key}>
                    <strong>{formatFieldName(key)}:</strong>{" "}
                    {typeof value === "object" ? JSON.stringify(value) : String(value)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
