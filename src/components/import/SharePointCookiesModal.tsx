/**
 * Modal para solicitar cookies de SharePoint durante la importación
 * Se muestra cuando se detectan URLs de SharePoint en el CSV
 */

"use client";

import { CheckCircle, XCircle, AlertCircle, Loader2, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface SharePointCookiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCookiesValidated: (cookies: Record<string, string>) => void;
  testImageUrl: string;
  detectedFields: string[];
}

interface ValidationResult {
  valid: boolean;
  message: string;
  details: {
    statusCode?: number;
    redirectedToLogin?: boolean;
    contentType?: string;
    responseSize?: number;
    error?: string;
  };
}

export default function SharePointCookiesModal({
  isOpen,
  onClose,
  onCookiesValidated,
  testImageUrl,
  detectedFields,
}: SharePointCookiesModalProps) {
  const [cookiesInput, setCookiesInput] = useState("");
  const [parsedCookies, setParsedCookies] = useState<Record<string, string> | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  if (!isOpen) return null;

  /**
   * Parsea cookies desde el formato del navegador:
   * "MSFPC=xxx; rtFa=yyy; FedAuth=zzz"
   * Extrae FedAuth y rtFa
   */
  const parseCookiesFromString = (cookieString: string): Record<string, string> | null => {
    try {
      const cookies: Record<string, string> = {};

      // Split por ; y procesar cada cookie
      const cookiePairs = cookieString.split(";");

      for (const pair of cookiePairs) {
        const trimmed = pair.trim();
        const equalIndex = trimmed.indexOf("=");

        if (equalIndex > 0) {
          const name = trimmed.substring(0, equalIndex).trim();
          const value = trimmed.substring(equalIndex + 1).trim();

          // Solo guardamos FedAuth y rtFa
          if (name === "FedAuth" || name === "rtFa") {
            cookies[name] = value;
          }
        }
      }

      // Validar que tenemos al menos una de las cookies requeridas
      if (cookies.FedAuth || cookies.rtFa) {
        return cookies;
      }

      return null;
    } catch (error) {
      console.error("Error parsing cookies:", error);
      return null;
    }
  };

  const handleCookiesInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCookiesInput(value);
    setValidationResult(null);

    // Parsear automáticamente mientras escribe
    if (value.trim()) {
      const parsed = parseCookiesFromString(value);
      setParsedCookies(parsed);
    } else {
      setParsedCookies(null);
    }
  };

  const handleValidate = async () => {
    if (!parsedCookies) {
      toast.error("No se pudieron detectar FedAuth o rtFa en las cookies pegadas");
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch("/api/sharepoint/validate-cookies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testImageUrl,
          customCookies: parsedCookies,
        }),
      });

      const result: ValidationResult = await response.json();
      setValidationResult(result);

      if (result.valid) {
        toast.success("✅ Cookies válidas");
        // Esperar 1 segundo para que el usuario vea el mensaje de éxito
        setTimeout(() => {
          onCookiesValidated(parsedCookies);
        }, 1000);
      } else {
        toast.error("❌ Cookies inválidas");
      }
    } catch (error) {
      const errorResult: ValidationResult = {
        valid: false,
        message: "Error al conectar con el servidor",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
      setValidationResult(errorResult);
      toast.error("Error al validar cookies");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSkip = () => {
    toast.error("No se pueden importar imágenes de SharePoint sin cookies válidas");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔐</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Autenticación de SharePoint Requerida
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Se detectaron {detectedFields.length} campo(s) de imagen con URLs de SharePoint
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Explicación */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  ¿Por qué necesitamos las cookies?
                </p>
                <p className="text-sm text-blue-800">
                  Tu CSV contiene enlaces a imágenes almacenadas en SharePoint. Para poder
                  descargarlas e importarlas correctamente, necesitamos las cookies de autenticación
                  de tu navegador.
                </p>
              </div>
            </div>
          </div>

          {/* Campos detectados */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Campos de imagen detectados con SharePoint:
            </p>
            <div className="flex flex-wrap gap-2">
              {detectedFields.map((field) => (
                <span
                  key={field}
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* Instrucciones */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900 mb-3">
              📋 Cómo obtener las cookies de SharePoint:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Abre SharePoint en tu navegador e inicia sesión</li>
              <li>
                Abre las DevTools (presiona{" "}
                <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">F12</kbd>
                )
              </li>
              <li>
                Ve a la pestaña <strong>Application</strong> → <strong>Cookies</strong>
              </li>
              <li>
                Busca y copia los valores de las cookies{" "}
                <code className="bg-gray-200 px-1 rounded">FedAuth</code> y{" "}
                <code className="bg-gray-200 px-1 rounded">rtFa</code>
              </li>
              <li>Pégalas en el campo de abajo (puedes pegar todas las cookies juntas)</li>
            </ol>
          </div>

          {/* Área de input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pega las cookies de SharePoint aquí:
            </label>
            <textarea
              value={cookiesInput}
              onChange={handleCookiesInputChange}
              placeholder="FedAuth=xxx; rtFa=yyy; (puedes pegar todas las cookies del navegador)"
              className="w-full h-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono resize-none"
              disabled={isValidating || (validationResult?.valid ?? false)}
            />
            <p className="mt-2 text-xs text-gray-500">
              💡 <strong>Tip:</strong> Solo se extraerán las cookies FedAuth y rtFa, las demás se
              ignorarán
            </p>
          </div>

          {/* Cookies detectadas */}
          {parsedCookies && !validationResult && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-2">✅ Cookies detectadas:</p>
              <div className="text-xs text-green-800 space-y-1 font-mono">
                {parsedCookies.FedAuth && (
                  <p>• FedAuth: {parsedCookies.FedAuth.substring(0, 50)}...</p>
                )}
                {parsedCookies.rtFa && <p>• rtFa: {parsedCookies.rtFa.substring(0, 50)}...</p>}
              </div>
            </div>
          )}

          {/* Error si no se detectan cookies */}
          {cookiesInput && !parsedCookies && !validationResult && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-900">
                ❌ No se detectaron FedAuth o rtFa en el texto pegado
              </p>
              <p className="text-xs text-red-700 mt-1">
                Asegúrate de copiar las cookies en formato:{" "}
                <code className="bg-red-100 px-1 rounded ml-1">nombre=valor; nombre2=valor2</code>
              </p>
            </div>
          )}

          {/* Resultado de validación */}
          {validationResult && (
            <div
              className={`p-4 rounded-lg border ${
                validationResult.valid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {validationResult.valid ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      validationResult.valid ? "text-green-900" : "text-red-900"
                    }`}
                  >
                    {validationResult.message}
                  </p>

                  {/* Detalles técnicos (solo si hay error) */}
                  {!validationResult.valid && validationResult.details && (
                    <div className="mt-2 text-xs text-red-700 space-y-1">
                      {validationResult.details.statusCode && (
                        <p>• Status Code: {validationResult.details.statusCode}</p>
                      )}
                      {validationResult.details.redirectedToLogin && (
                        <p>• Redirigido a página de login</p>
                      )}
                      {validationResult.details.contentType && (
                        <p>• Content-Type: {validationResult.details.contentType}</p>
                      )}
                      {validationResult.details.error && (
                        <p>• Error: {validationResult.details.error}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
            disabled={isValidating}
          >
            Cancelar Importación
          </button>

          <button
            onClick={handleValidate}
            disabled={!parsedCookies || isValidating || (validationResult?.valid ?? false)}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Validando...</span>
              </>
            ) : validationResult?.valid ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Validado ✓</span>
              </>
            ) : (
              <span>Validar Cookies</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
