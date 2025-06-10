'use client';

import { useState } from 'react';

interface ImageValidatorProps {
  imageUrl: string;
  descripcionAcceso?: string;
  onValidationComplete: (isValid: boolean) => void;
  onCancel: () => void;
}

export default function ImageValidator({ 
  imageUrl, 
  descripcionAcceso, 
  onValidationComplete, 
  onCancel 
}: ImageValidatorProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleValidation = async (isValid: boolean) => {
    setIsLoading(true);
    try {
      // Simular un pequeño delay para mejor UX
      await new Promise(resolve => setTimeout(resolve, 500));
      onValidationComplete(isValid);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Imagen a validar */}
      <div className="bg-gray-50 rounded-lg p-2 md:p-4">
        <h3 className="text-lg font-semibold mb-4">Segunda Imagen del DEA</h3>
        <div className="flex justify-center">
          <img
            src={imageUrl}
            alt="Segunda imagen del DEA"
            className="w-full max-w-sm md:max-w-md lg:max-w-lg rounded-lg shadow-md aspect-square object-cover"
          />
        </div>
      </div>

      {/* Descripción de acceso */}
      {descripcionAcceso && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-blue-800 mb-2">
            Descripción de Acceso
          </h4>
          <p className="text-blue-700">{descripcionAcceso}</p>
        </div>
      )}

      {/* Instrucciones */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-md font-semibold text-yellow-800 mb-2">
          ¿Es esta una foto válida?
        </h4>
        <p className="text-yellow-700 text-sm">
          Verifica que la imagen muestre claramente el DEA y su ubicación. 
          Si la imagen está borrosa, mal enfocada, o no muestra el DEA correctamente, 
          márcala como inválida.
        </p>
      </div>

      {/* Botones de validación */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors order-last sm:order-first"
          disabled={isLoading}
        >
          Cancelar
        </button>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => handleValidation(false)}
            disabled={isLoading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Procesando...' : 'Imagen Inválida'}
          </button>
          
          <button
            onClick={() => handleValidation(true)}
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Procesando...' : 'Imagen Válida'}
          </button>
        </div>
      </div>
    </div>
  );
}
