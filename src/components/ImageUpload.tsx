'use client'

import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';

interface ImageUploadProps {
  label: string;
  value?: string;
  onChange: (url: string | null) => void;
  prefix: string;
  required?: boolean;
}

export default function ImageUpload({ 
  label, 
  value, 
  onChange, 
  prefix, 
  required = false 
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loading, error, uploadImage } = useImageUpload();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Crear preview local
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Subir a S3
    const url = await uploadImage(file, prefix);
    if (url) {
      onChange(url);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        {preview ? (
          // Mostrar imagen subida
          <div className="relative group">
            <img
              src={preview}
              alt={label}
              className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
              <button
                type="button"
                onClick={handleRemove}
                title="Eliminar imagen"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            )}
          </div>
        ) : (
          // Área de subida
          <div
            onClick={handleClick}
            className={`
              w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors
              ${loading ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              flex flex-col items-center justify-center space-y-2
            `}
          >
            {loading ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-blue-600">Subiendo imagen...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    Haz clic para subir una imagen
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG, PNG o WebP (máx. 5MB)
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={loading}
          aria-label={`Subir ${label}`}
        />
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-red-600 text-sm">
          <X className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
