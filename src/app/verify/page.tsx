'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DeaRecord } from '@/types';

export default function VerifyPage() {
  const [deaRecords, setDeaRecords] = useState<DeaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchDeaRecords();
  }, []);

  const fetchDeaRecords = async () => {
    try {
      const response = await fetch('/api/verify');
      if (!response.ok) {
        throw new Error('Error al cargar registros');
      }
      const data = await response.json();
      setDeaRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const startVerification = async (deaId: number) => {
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deaId }),
      });

      if (!response.ok) {
        throw new Error('Error al iniciar verificación');
      }

      const session = await response.json();
      router.push(`/verify/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar verificación');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando registros...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDeaRecords}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Verificación de DEAs
          </h1>
          <p className="text-gray-600">
            Selecciona un DEA para iniciar el proceso de verificación de imágenes
          </p>
        </div>

        {deaRecords.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No hay DEAs para verificar
            </h3>
            <p className="text-gray-600">
              Todos los DEAs con imágenes ya han sido verificados
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deaRecords.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {record.foto1 && (
                  <div className="h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={record.foto1}
                      alt={`DEA ${record.numeroProvisionalDea}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      DEA #{record.numeroProvisionalDea}
                    </h3>
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      {record.tipoEstablecimiento}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Nombre:</span> {record.nombre}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Dirección:</span>{' '}
                      {record.tipoVia} {record.nombreVia} {record.numeroVia}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Distrito:</span> {record.distrito}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => startVerification(record.id)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Iniciar Verificación
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
