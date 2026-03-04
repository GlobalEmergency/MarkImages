/**
 * ImportWizard: Flujo completo de importación con mapeo de columnas
 * Gestiona los 4 pasos: Upload → Preview & Mapping → Validation → Import
 */

"use client";

import { ArrowLeft, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import ColumnMappingEditor from "./ColumnMappingEditor";
import SharePointCookiesModal from "./SharePointCookiesModal";
import ValidationErrorsTable from "./ValidationErrorsTable";
import ImportPreviewTable from "./ImportPreviewTable";

type Step = "upload" | "preview" | "mapping" | "validation";

interface ImportWizardProps {
  onComplete?: (batchId: string) => void;
}

export default function ImportWizard({ onComplete: _onComplete }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [sessionData, setSessionData] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  const steps = [
    { id: "upload", label: "Subir CSV", icon: "📤" },
    { id: "preview", label: "Preview", icon: "👁️" },
    { id: "mapping", label: "Mapear Columnas", icon: "🔗" },
    { id: "validation", label: "Validación", icon: "✓" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleFileUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al procesar el archivo");
      }

      const data = await response.json();
      setSessionData(data);
      setCurrentStep("mapping");
      toast.success("✅ Archivo procesado correctamente");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(error instanceof Error ? error.message : "Error al subir el archivo");
    }
  };

  const handleMappingComplete = (
    mappings: Array<{ csvColumn: string; systemField: string; confidence: number }>
  ) => {
    setSessionData((prev: any) => ({ ...prev, mappings }));
    setCurrentStep("validation");
    toast.success("✅ Mapeo confirmado, procediendo a validación");
  };

  const handleValidationComplete = (validation: any) => {
    setSessionData((prev: any) => ({ ...prev, validation }));
    if (!(validation.validation?.isValid && validation.summary?.errors === 0)) {
      toast.error("❌ Hay errores que deben corregirse antes de importar");
    }
  };

  const handleSharePointCookiesSet = (cookies: Record<string, string>) => {
    setSessionData((prev: any) => ({ ...prev, sharepointCookies: cookies }));
  };

  const handleStartImport = async () => {
    // Crear clave única basada en el filePath
    const importKey = `importing_${sessionData.filePath}`;

    // Verificar si ya hay una importación en proceso para este archivo
    if (localStorage.getItem(importKey)) {
      toast.error("Ya hay una importación en proceso para este archivo");
      return;
    }

    // Prevenir múltiples clicks
    if (isImporting) return;

    setIsImporting(true);

    // Marcar como importando en localStorage
    localStorage.setItem(importKey, "true");

    try {
      toast.loading("🚀 Iniciando importación...", { id: "import-start" });

      // Llamar al API para iniciar la importación
      const response = await fetch("/api/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filePath: sessionData.filePath,
          mappings: sessionData.mappings,
          sharepointCookies: sessionData.sharepointCookies, // ← Enviar cookies de SharePoint si existen
          batchName: `Importación ${new Date().toLocaleString()}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al iniciar la importación");
      }

      await response.json();

      toast.success("✅ Importación iniciada correctamente", { id: "import-start" });

      // Redirigir usando window.location para mayor confiabilidad
      window.location.href = "/import";
    } catch (error) {
      // Limpiar flag y re-habilitar el botón si hay error
      localStorage.removeItem(importKey);
      setIsImporting(false);
      console.error("Error starting import:", error);
      toast.error(error instanceof Error ? error.message : "Error al iniciar la importación", {
        id: "import-start",
      });
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      {/* Barra de progreso */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                  index < currentStepIndex
                    ? "bg-green-500 text-white"
                    : index === currentStepIndex
                      ? "bg-blue-500 text-white ring-4 ring-blue-200"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {index < currentStepIndex ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <span className="text-xl">{step.icon}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-20 h-1 mx-2 transition-all ${
                    index < currentStepIndex ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm">
          {steps.map((step) => (
            <span
              key={step.id}
              className={`font-medium ${
                step.id === currentStep ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>

      {/* Contenido del paso actual */}
      <div className="bg-white rounded-lg shadow-lg p-8 min-h-[500px]">
        {currentStep === "upload" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Paso 1: Subir archivo CSV</h2>
            <p className="text-gray-600 mb-6">
              Selecciona el archivo CSV que deseas importar. El sistema analizará automáticamente
              las columnas y sugerirá mapeos.
            </p>
            <FileUploadZone onFileSelect={handleFileUpload} />
          </div>
        )}

        {currentStep === "mapping" && sessionData && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Paso 2: Mapeo de Columnas</h2>
            <p className="text-gray-600 mb-6">
              Configura cómo se mapearán las columnas de tu CSV a los campos del sistema. Los campos
              marcados con <span className="text-red-600 font-bold">*</span> son obligatorios.
            </p>
            <ColumnMappingEditor
              preview={sessionData.preview}
              suggestions={sessionData.suggestions}
              initialMappings={sessionData.mappings}
              onMappingsConfirmed={handleMappingComplete}
            />
          </div>
        )}

        {currentStep === "validation" && sessionData && (
          <ValidationStep
            sessionData={sessionData}
            onValidationComplete={handleValidationComplete}
            onStartImport={handleStartImport}
            isImporting={isImporting}
            onSharePointCookiesSet={handleSharePointCookiesSet}
          />
        )}
      </div>

      {/* Navegación */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => {
            const prevStep = steps[currentStepIndex - 1];
            if (prevStep) setCurrentStep(prevStep.id as Step);
          }}
          disabled={currentStepIndex === 0}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Anterior</span>
        </button>

        <div className="text-sm text-gray-500">
          Paso {currentStepIndex + 1} de {steps.length}
        </div>
      </div>
    </div>
  );
}

// Componente de validación
function ValidationStep({
  sessionData,
  onValidationComplete,
  onStartImport,
  isImporting,
  onSharePointCookiesSet,
}: {
  sessionData: any;
  onValidationComplete: (validation: any) => void;
  onStartImport: () => void;
  isImporting: boolean;
  onSharePointCookiesSet: (cookies: Record<string, string>) => void;
}) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showSharePointModal, setShowSharePointModal] = useState(false);
  const [sharePointInfo, setSharePointInfo] = useState<{
    detected: boolean;
    sampleUrls: string[];
    imageFields: string[];
  } | null>(null);

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const response = await fetch("/api/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: sessionData.filePath,
          preview: sessionData.preview,
          mappings: sessionData.mappings,
          maxRowsToValidate: 100,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la validación");
      }

      const validation = await response.json();
      setValidationResult(validation);
      onValidationComplete(validation);

      // Si se detectó SharePoint y aún no tenemos cookies, mostrar modal
      if (validation.sharepoint?.detected && !sessionData.sharepointCookies) {
        setSharePointInfo(validation.sharepoint);
        setShowSharePointModal(true);
      }
    } catch (error) {
      toast.error("Error en la validación");
      console.error(error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSharePointCookiesValidated = (cookies: Record<string, string>) => {
    onSharePointCookiesSet(cookies);
    setShowSharePointModal(false);
    toast.success("✅ Cookies de SharePoint configuradas correctamente");
  };

  const handleSharePointModalClose = () => {
    setShowSharePointModal(false);
    toast.error(
      "Importación cancelada: Se requieren cookies de SharePoint para importar las imágenes"
    );
  };

  return (
    <>
      <SharePointCookiesModal
        isOpen={showSharePointModal}
        onClose={handleSharePointModalClose}
        onCookiesValidated={handleSharePointCookiesValidated}
        testImageUrl={sharePointInfo?.sampleUrls[0] || ""}
        detectedFields={sharePointInfo?.imageFields || []}
      />
      <div>
        <h2 className="text-2xl font-bold mb-4">Paso 3: Validación de Datos</h2>
        <p className="text-gray-600 mb-6">
          Validaremos los datos antes de la importación para detectar posibles errores.
        </p>

        {!validationResult ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Listo para validar</h3>
            <p className="text-gray-600 mb-6">
              Se validarán las primeras 100 filas para detectar problemas
            </p>
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center space-x-2 mx-auto"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <span>Iniciar Validación</span>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen de validación */}
            <div
              className={`p-4 rounded-lg border ${
                validationResult.validation?.isValid && validationResult.summary?.errors === 0
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <h3
                className={`font-bold mb-2 ${
                  validationResult.validation?.isValid && validationResult.summary?.errors === 0
                    ? "text-green-900"
                    : "text-red-900"
                }`}
              >
                {validationResult.validation?.isValid && validationResult.summary?.errors === 0
                  ? "✅ Validación exitosa"
                  : "❌ Se encontraron errores"}
              </h3>
              <p
                className={`text-sm ${
                  validationResult.validation?.isValid && validationResult.summary?.errors === 0
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {validationResult.validation?.isValid && validationResult.summary?.errors === 0
                  ? "Los datos están listos para importarse"
                  : "Debes corregir los errores antes de continuar"}
              </p>
            </div>

            {/* Estadísticas de validación */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {validationResult.validation?.totalRecords || 0}
                </div>
                <div className="text-sm text-gray-600">Total registros</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-900">
                  {validationResult.validation?.validRecords || 0}
                </div>
                <div className="text-sm text-green-700">Válidos</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-900">
                  {validationResult.validation?.invalidRecords || 0}
                </div>
                <div className="text-sm text-red-700">Con errores</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-900">
                  {validationResult.validation?.skippedRecords || 0}
                </div>
                <div className="text-sm text-blue-700">Omitidos</div>
              </div>
            </div>

            {/* Preview de registros */}
            <ImportPreviewTable previewRecords={validationResult.previewRecords} />

            {/* Mostrar errores detallados si existen */}
            {validationResult.errors && validationResult.errors.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  Errores encontrados ({validationResult.errors.length})
                </h4>
                <ValidationErrorsTable
                  errors={validationResult.errors}
                  errorSummary={validationResult.errorSummary}
                />
              </div>
            )}

            {/* Botón para iniciar importación */}
            {validationResult.validation?.isValid && validationResult.summary?.errors === 0 && (
              <div className="flex justify-center pt-6">
                <button
                  onClick={onStartImport}
                  disabled={isImporting}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Iniciando...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">🚀</span>
                      <span>Iniciar Importación</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// Componente auxiliar temporal para upload
function FileUploadZone({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      onDragEnter={() => setDragActive(true)}
      onDragLeave={() => setDragActive(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
        dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <input
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center space-y-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-4xl">📤</span>
        </div>
        <div>
          <p className="text-lg font-medium text-gray-700">Arrastra tu archivo CSV aquí</p>
          <p className="text-sm text-gray-500 mt-1">o haz clic para seleccionar (máx. 10MB)</p>
        </div>
      </label>
    </div>
  );
}
