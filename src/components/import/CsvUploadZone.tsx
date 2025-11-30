/**
 * Componente para subir archivos CSV con drag & drop
 */

"use client";

import { Upload, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import toast from "react-hot-toast";

import { useCsvUpload } from "@/hooks/useCsvUpload";

interface CsvUploadZoneProps {
  onUploadStart: (batchId: string) => void;
}

export default function CsvUploadZone({ onUploadStart }: CsvUploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploading, error, uploadCsv, reset } = useCsvUpload();

  // Validar archivo
  const validateFile = (file: File): string | null => {
    if (!file.name.endsWith(".csv")) {
      return "Solo se permiten archivos CSV";
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return "El archivo no debe superar los 10MB";
    }

    return null;
  };

  // Validar estructura del CSV
  const validateCsvStructure = async (file: File): Promise<string | null> => {
    try {
      const text = await file.text();
      const lines = text.split("\n");

      if (lines.length < 2) {
        return "El archivo CSV está vacío o no tiene datos";
      }

      // Obtener header
      const header = lines[0];
      const columns = header.split(";").map((col) => col.trim());

      // Columnas mínimas requeridas
      const requiredColumns = ["Nombre", "Distrito"];

      // Verificar que existan las columnas requeridas
      const missingColumns = requiredColumns.filter(
        (reqCol) => !columns.some((col) => col.includes(reqCol))
      );

      if (missingColumns.length > 0) {
        return `Faltan columnas requeridas: ${missingColumns.join(", ")}`;
      }

      return null; // Validación exitosa
    } catch (error) {
      return "Error al leer el archivo CSV";
    }
  };

  // Manejar selección de archivo
  const handleFileSelect = async (file: File) => {
    // Validación básica
    const basicError = validateFile(file);
    if (basicError) {
      toast.error(basicError);
      return;
    }

    // Validación de estructura (async)
    const structureError = await validateCsvStructure(file);
    if (structureError) {
      toast.error(structureError);
      return;
    }

    setSelectedFile(file);
    // Generar nombre automático del batch
    const timestamp = new Date().toLocaleDateString("es-ES");
    setBatchName(`Importación ${file.name} - ${timestamp}`);
    reset();
    toast.success("✅ Archivo CSV validado correctamente");
  };

  // Drag & drop handlers
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Input file handler
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Click handler
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Remover archivo
  const handleRemove = () => {
    setSelectedFile(null);
    setBatchName("");
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Iniciar importación
  const handleUpload = async () => {
    if (!selectedFile || !batchName.trim()) {
      toast.error("Por favor selecciona un archivo y proporciona un nombre");
      return;
    }

    const batchId = await uploadCsv(selectedFile, batchName);
    if (batchId) {
      toast.success("🚀 Importación iniciada correctamente");
      onUploadStart(batchId);
      // Limpiar formulario
      handleRemove();
    }
  };

  return (
    <div className="space-y-4">
      {/* Zona de drag & drop */}
      {!selectedFile ? (
        <div
          onClick={handleClick}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer
            ${
              dragActive
                ? "border-blue-500 bg-blue-50"
                : uploading
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400 bg-white"
            }
          `}
        >
          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                dragActive ? "bg-blue-100" : "bg-gray-100"
              }`}
            >
              <Upload
                className={`w-8 h-8 ${dragActive ? "text-blue-600" : "text-gray-400"}`}
              />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-gray-700">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-sm text-gray-500 mt-1">
                o haz clic para seleccionar
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Archivos CSV (máx. 10MB)
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleChange}
            className="hidden"
            disabled={uploading}
          />
        </div>
      ) : (
        // Archivo seleccionado
        <div className="border-2 border-gray-200 rounded-xl p-6 bg-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Eliminar archivo"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Nombre del batch */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Nombre de la importación
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              disabled={uploading}
              placeholder="Ej: Importación Madrid 2025"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Botón de importar */}
          <button
            onClick={handleUpload}
            disabled={uploading || !batchName.trim()}
            className="mt-4 w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Iniciando importación...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Iniciar Importación</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div className="flex items-start space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
