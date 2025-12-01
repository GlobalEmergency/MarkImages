/**
 * ImportWizard: Flujo completo de importación con mapeo de columnas
 * Gestiona los 4 pasos: Upload → Preview & Mapping → Validation → Import
 */

'use client';

import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

type Step = 'upload' | 'preview' | 'mapping' | 'validation' | 'importing';

interface ImportWizardProps {
  onComplete?: (batchId: string) => void;
}

export default function ImportWizard({ onComplete: _onComplete }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [sessionData, setSessionData] = useState<any>(null);

  const steps = [
    { id: 'upload', label: 'Subir CSV', icon: '📤' },
    { id: 'preview', label: 'Preview', icon: '👁️' },
    { id: 'mapping', label: 'Mapear Columnas', icon: '🔗' },
    { id: 'validation', label: 'Validación', icon: '✓' },
    { id: 'importing', label: 'Importando', icon: '⚡' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleFileUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/preview', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al procesar el archivo');
      }

      const data = await response.json();
      setSessionData(data);
      setCurrentStep('mapping');
      toast.success('✅ Archivo procesado correctamente');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error instanceof Error ? error.message : 'Error al subir el archivo');
    }
  };

  const handleMappingComplete = (mappings: any[]) => {
    setSessionData((prev: any) => ({ ...prev, mappings }));
    setCurrentStep('validation');
  };

  const handleValidationComplete = (validation: any) => {
    if (validation.summary.canProceed) {
      setSessionData((prev: any) => ({ ...prev, validation }));
      // Aquí iniciaríamos la importación real
      toast.success('✅ Validación exitosa. Listo para importar.');
    } else {
      toast.error('❌ Hay errores que deben corregirse antes de importar');
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
                    ? 'bg-green-500 text-white'
                    : index === currentStepIndex
                      ? 'bg-blue-500 text-white ring-4 ring-blue-200'
                      : 'bg-gray-200 text-gray-500'
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
                    index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
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
                step.id === currentStep ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>

      {/* Contenido del paso actual */}
      <div className="bg-white rounded-lg shadow-lg p-8 min-h-[500px]">
        {currentStep === 'upload' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Paso 1: Subir archivo CSV</h2>
            <p className="text-gray-600 mb-6">
              Selecciona el archivo CSV que deseas importar. El sistema analizará
              automáticamente las columnas y sugerirá mapeos.
            </p>
            <FileUploadZone onFileSelect={handleFileUpload} />
          </div>
        )}

        {currentStep === 'mapping' && sessionData && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Paso 2-3: Preview y Mapeo de Columnas</h2>
            <p className="text-gray-600 mb-6">
              Revisa el preview de tu CSV y configura cómo se mapearán las columnas a los campos
              del sistema.
            </p>
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">📊 Componente de mapeo en construcción</p>
              <p className="text-sm">Preview: {sessionData.preview.totalRows} filas detectadas</p>
              <p className="text-sm">
                Sugerencias: {sessionData.suggestions.length} mapeos automáticos
              </p>
              <button
                onClick={() => handleMappingComplete(sessionData.suggestions)}
                className="mt-6 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Continuar con mapeos sugeridos →
              </button>
            </div>
          </div>
        )}

        {currentStep === 'validation' && sessionData && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Paso 4: Validación de Datos</h2>
            <p className="text-gray-600 mb-6">
              Validando los datos antes de la importación...
            </p>
            <div className="text-center py-8">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/import/validate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        filePath: sessionData.filePath,
                        preview: sessionData.preview,
                        mappings: sessionData.mappings,
                        maxRowsToValidate: 100,
                      }),
                    });

                    const validation = await response.json();
                    handleValidationComplete(validation);
                  } catch {
                    toast.error('Error en la validación');
                  }
                }}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Iniciar Validación
              </button>
            </div>
          </div>
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
        dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <input
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="cursor-pointer flex flex-col items-center space-y-4"
      >
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-4xl">📤</span>
        </div>
        <div>
          <p className="text-lg font-medium text-gray-700">
            Arrastra tu archivo CSV aquí
          </p>
          <p className="text-sm text-gray-500 mt-1">
            o haz clic para seleccionar (máx. 10MB)
          </p>
        </div>
      </label>
    </div>
  );
}
