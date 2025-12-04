/**
 * Componente: Validador de Cookies de SharePoint
 * Permite validar que las cookies configuradas en .env son válidas
 * antes de iniciar una importación
 */

"use client";

import { CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

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

interface SharePointCookiesValidatorProps {
  testImageUrl: string;
}

export default function SharePointCookiesValidator({
  testImageUrl,
}: SharePointCookiesValidatorProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [cookiesInput, setCookiesInput] = useState("");
  const [showCookiesInput, setShowCookiesInput] = useState(false);
  const [parsedCookies, setParsedCookies] = useState<Record<string, string> | null>(null);

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

    // Parsear automáticamente mientras escribe
    if (value.trim()) {
      const parsed = parseCookiesFromString(value);
      setParsedCookies(parsed);
    } else {
      setParsedCookies(null);
    }
  };

  const handleValidate = async (useCustomCookies: boolean = false) => {
    setIsValidating(true);
    setValidationResult(null);

    // Si se usa custom cookies, validar que están parseadas
    if (useCustomCookies && !parsedCookies) {
      toast.error("No se pudieron detectar FedAuth o rtFa en las cookies pegadas");
      setIsValidating(false);
      return;
    }

    try {
      const body: any = {
        testImageUrl,
      };

      // Si usamos cookies custom, enviarlas en el body
      if (useCustomCookies && parsedCookies) {
        body.customCookies = parsedCookies;
      }

      const response = await fetch("/api/sharepoint/validate-cookies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result: ValidationResult = await response.json();
      setValidationResult(result);

      if (result.valid) {
        toast.success("✅ Cookies válidas");
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

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🔐</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Validación de Cookies de SharePoint</h3>
            <p className="text-sm text-gray-600 mt-1">
              Verifica que las cookies configuradas permiten importar imágenes
            </p>
          </div>
        </div>
      </div>

      {/* Estado de validación */}
      {validationResult && !isValidating && (
        <div
          className={`mb-4 p-4 rounded-lg border ${
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

              {/* Mensaje de ayuda si las cookies son inválidas */}
              {!validationResult.valid && (
                <div className="mt-3 p-3 bg-white border border-red-200 rounded text-sm">
                  <p className="font-medium text-red-900 mb-2">¿Cómo solucionar?</p>
                  <ol className="list-decimal list-inside space-y-1 text-red-800">
                    <li>Abre SharePoint en tu navegador e inicia sesión</li>
                    <li>
                      Abre las DevTools (F12) → pestaña{" "}
                      <code className="bg-red-100 px-1 rounded">Application</code> → Cookies
                    </li>
                    <li>
                      Copia los valores de <code className="bg-red-100 px-1 rounded">FedAuth</code>{" "}
                      y <code className="bg-red-100 px-1 rounded">rtFa</code>
                    </li>
                    <li>
                      Actualiza el archivo <code className="bg-red-100 px-1 rounded">.env</code> con
                      los nuevos valores
                    </li>
                    <li>Reinicia el servidor de desarrollo</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sin validación todavía */}
      {!validationResult && !isValidating && (
        <div className="mb-4 p-4 rounded-lg border border-yellow-200 bg-yellow-50">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-yellow-900">Estado sin verificar</p>
              <p className="text-sm text-yellow-800 mt-1">
                Las cookies configuradas en <code className="bg-yellow-100 px-1 rounded">.env</code>{" "}
                no han sido validadas. Haz clic en "Validar Cookies" para verificar que funcionan
                correctamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Área para pegar cookies */}
      <div className="mb-4">
        <button
          onClick={() => setShowCookiesInput(!showCookiesInput)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-2 flex items-center space-x-1"
        >
          <span>{showCookiesInput ? "▼" : "▶"}</span>
          <span>Validar con cookies personalizadas (sin modificar .env)</span>
        </button>

        {showCookiesInput && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pega todas las cookies del navegador aquí:
              </label>
              <textarea
                value={cookiesInput}
                onChange={handleCookiesInputChange}
                placeholder="MSFPC=GUID=xxx; rtFa=yyy; SIMI=zzz; FedAuth=www..."
                className="w-full h-24 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">
                💡 <strong>Tip:</strong> En DevTools → Application → Cookies, haz clic derecho en
                cualquier cookie → "Show Requests with this Cookie" → Copia el valor completo de
                "Cookie" del header
              </p>
            </div>

            {/* Indicador de cookies detectadas */}
            {parsedCookies && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
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
            {cookiesInput && !parsedCookies && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900">
                  ❌ No se detectaron FedAuth o rtFa en el texto pegado
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Asegúrate de copiar las cookies en formato:
                  <code className="bg-red-100 px-1 rounded ml-1">nombre=valor; nombre2=valor2</code>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Botón para validar con cookies del .env */}
        <button
          onClick={() => handleValidate(false)}
          disabled={isValidating}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isValidating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Validando...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              <span>Validar Cookies (.env)</span>
            </>
          )}
        </button>

        {/* Botón para validar con cookies pegadas */}
        {showCookiesInput && parsedCookies && (
          <button
            onClick={() => handleValidate(true)}
            disabled={isValidating}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Validando...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                <span>Validar Cookies Pegadas</span>
              </>
            )}
          </button>
        )}

        {validationResult && (
          <span className="text-sm text-gray-600">
            {validationResult.valid
              ? "✓ Listo para importar"
              : "✗ Actualiza las cookies antes de importar"}
          </span>
        )}
      </div>

      {/* Información adicional */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          <strong>Nota:</strong> Las cookies de SharePoint (FedAuth, rtFa) caducan periódicamente.
          Si la importación falla por errores de autenticación, vuelve a validar las cookies aquí.
        </p>
      </div>
    </div>
  );
}
