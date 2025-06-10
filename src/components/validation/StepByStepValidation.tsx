'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  MapPin, 
  Mail,
  Building,
  Navigation,
  Loader2,
  ArrowRight,
  ArrowLeft,
  SkipForward
} from 'lucide-react';

interface ValidationStep {
  stepNumber: 1 | 2 | 3 | 4;
  title: string;
  status: 'pending' | 'current' | 'completed' | 'skipped';
  required: boolean;
  skipReason?: string;
}

interface StepValidationProgress {
  deaRecordId: number;
  currentStep: number;
  totalSteps: number;
  steps: ValidationStep[];
  stepData: {
    step1?: {
      selectedAddress: any;
      userConfirmed: boolean;
      timestamp: Date;
    };
    step2?: {
      originalPostalCode: string;
      confirmedPostalCode: string;
      userConfirmed: boolean;
      autoSkipped: boolean;
      timestamp: Date;
    };
    step3?: {
      originalDistrict: string;
      confirmedDistrict: number;
      userConfirmed: boolean;
      autoSkipped: boolean;
      timestamp: Date;
    };
    step4?: {
      originalCoordinates: { lat: number; lng: number };
      confirmedCoordinates: { lat: number; lng: number };
      distance: number;
      userConfirmed: boolean;
      autoSkipped: boolean;
      timestamp: Date;
    };
  };
  isComplete: boolean;
  completedAt?: Date;
}

interface StepByStepValidationProps {
  deaRecordId: number;
  onComplete?: (progress: StepValidationProgress) => void;
}

export default function StepByStepValidation({ 
  deaRecordId, 
  onComplete 
}: StepByStepValidationProps) {
  const [progress, setProgress] = useState<StepValidationProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step1Data, setStep1Data] = useState<any>(null);
  const [currentStepData, setCurrentStepData] = useState<any>({});

  useEffect(() => {
    initializeValidation();
  }, [deaRecordId]);

  const initializeValidation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/dea/${deaRecordId}/validate-steps`);
      const data = await response.json();
      
      if (data.success) {
        setProgress(data.data.progress);
        if (data.data.step1Data) {
          setStep1Data(data.data.step1Data);
        }
      } else {
        setError(data.error || 'Error inicializando validación');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const executeStep = async (stepNumber: number, stepData: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/dea/${deaRecordId}/validate-steps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          step: stepNumber,
          data: stepData
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProgress(data.data.progress);
        setCurrentStepData({});
        
        if (data.data.isComplete) {
          onComplete?.(data.data.progress);
        }
      } else {
        setError(data.error || 'Error ejecutando paso');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (step: ValidationStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'current':
        return <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>;
      case 'skipped':
        return <SkipForward className="w-5 h-5 text-gray-400" />;
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full"></div>;
    }
  };

  const getStepColor = (step: ValidationStep) => {
    switch (step.status) {
      case 'completed':
        return 'text-green-600';
      case 'current':
        return 'text-blue-600 font-semibold';
      case 'skipped':
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  };

  const renderStep1 = () => {
    if (!step1Data?.searchResult) return null;

    const { searchResult } = step1Data;
    
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">
            Confirme la dirección oficial encontrada
          </h4>
          
          
          {searchResult.found ? (
            <div className="space-y-3">
              {searchResult.officialData && (
                <div className="bg-white p-3 rounded border border-blue-200">
                  <div className="flex items-center mb-2">
                    {searchResult.exactMatch ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
                    )}
                    <span className="font-medium">
                      {searchResult.exactMatch ? 'Coincidencia exacta' : 'Mejor coincidencia'}
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div><strong>Dirección:</strong> {searchResult.officialData.tipoVia} {searchResult.officialData.nombreVia} {searchResult.officialData.numeroVia}</div>
                    <div><strong>Código Postal:</strong> {searchResult.officialData.codigoPostal}</div>
                    <div><strong>Distrito:</strong> {searchResult.officialData.distrito}</div>
                    <div><strong>Confianza:</strong> {(searchResult.officialData.confidence * 100).toFixed(1)}%</div>
                    {searchResult.officialData.latitud && searchResult.officialData.longitud && (
                      <div className="mt-2 p-2 bg-blue-50 rounded">
                        <div><strong>Coordenadas Oficiales:</strong></div>
                        <div className="font-mono text-xs">
                          Lat: {searchResult.officialData.latitud.toFixed(6)}, 
                          Lng: {searchResult.officialData.longitud.toFixed(6)}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => executeStep(1, { selectedAddress: searchResult.officialData })}
                    disabled={loading}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar esta dirección'}
                  </button>
                </div>
              )}
              
              {searchResult.alternatives.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-700 mb-2">Alternativas disponibles:</h5>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {searchResult.alternatives.map((alt: any, index: number) => (
                      <div key={index} className="bg-yellow-50 p-2 rounded border">
                        <div className="text-sm">
                          <div><strong>Dirección:</strong> {alt.tipoVia} {alt.nombreVia} {alt.numeroVia}</div>
                          <div><strong>CP:</strong> {alt.codigoPostal} | <strong>Distrito:</strong> {alt.distrito}</div>
                          <div><strong>Confianza:</strong> {(alt.confidence * 100).toFixed(1)}%</div>
                        </div>
                        <button
                          onClick={() => executeStep(1, { selectedAddress: alt })}
                          disabled={loading}
                          className="mt-2 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                        >
                          Seleccionar esta
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-red-50 p-3 rounded border border-red-200">
              <div className="flex items-center text-red-700">
                <XCircle className="w-4 h-4 mr-2" />
                <span>No se encontró dirección oficial</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                Verifique los datos de la dirección manualmente
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    const step1Address = progress?.stepData.step1?.selectedAddress;
    if (!step1Address) return null;

    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">
            Información del DEA - Verificación de Datos
          </h4>
          
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border">
              <div className="text-sm space-y-2">
                <div>
                  <strong>Código Postal Oficial:</strong> 
                  <span className="ml-2 font-mono text-blue-600">{step1Address.codigoPostal}</span>
                </div>
                
                {/* Mostrar información de coordenadas y distancia si está disponible */}
                {step1Data?.searchResult?.step2_verification?.coordinatesComparison && (
                  <div className="mt-3 p-3 bg-blue-50 rounded border">
                    <div className="font-medium text-blue-800 mb-2">Comparación de Coordenadas</div>
                    
                    {step1Data.searchResult.step2_verification.coordinatesComparison.userCoordinates && (
                      <div className="text-xs space-y-1">
                        <div>
                          <strong>Coordenadas del Usuario:</strong>
                          <div className="font-mono ml-4">
                            Lat: {step1Data.searchResult.step2_verification.coordinatesComparison.userCoordinates.lat.toFixed(6)}<br/>
                            Lng: {step1Data.searchResult.step2_verification.coordinatesComparison.userCoordinates.lng.toFixed(6)}
                          </div>
                        </div>
                        
                        {step1Data.searchResult.step2_verification.coordinatesComparison.officialCoordinates && (
                          <div>
                            <strong>Coordenadas Oficiales:</strong>
                            <div className="font-mono ml-4">
                              Lat: {step1Data.searchResult.step2_verification.coordinatesComparison.officialCoordinates.lat.toFixed(6)}<br/>
                              Lng: {step1Data.searchResult.step2_verification.coordinatesComparison.officialCoordinates.lng.toFixed(6)}
                            </div>
                          </div>
                        )}
                        
                        {step1Data.searchResult.step2_verification.coordinatesComparison.distanceInMeters !== null && (
                          <div className="mt-2 p-2 bg-white rounded border">
                            <div className="flex items-center">
                              {step1Data.searchResult.step2_verification.coordinatesComparison.isWithinAcceptableRange ? (
                                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
                              )}
                              <div>
                                <strong>Distancia:</strong> {Math.round(step1Data.searchResult.step2_verification.coordinatesComparison.distanceInMeters)}m
                                <div className="text-xs text-gray-600">
                                  {step1Data.searchResult.step2_verification.coordinatesComparison.isWithinAcceptableRange 
                                    ? 'Dentro del rango aceptable (≤100m)' 
                                    : 'Fuera del rango aceptable (>100m) - Requiere revisión'
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="text-gray-600">
                  ¿Confirma que este es el código postal correcto?
                </div>
              </div>
              
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => executeStep(2, { confirmedPostalCode: step1Address.codigoPostal })}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                </button>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Código postal alternativo"
                    value={currentStepData.customPostalCode || ''}
                    onChange={(e) => setCurrentStepData(prev => ({ ...prev, customPostalCode: e.target.value }))}
                    className="px-3 py-2 border rounded text-sm"
                    maxLength={5}
                  />
                  <button
                    onClick={() => executeStep(2, { confirmedPostalCode: currentStepData.customPostalCode })}
                    disabled={loading || !currentStepData.customPostalCode}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    Usar este
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    const step1Address = progress?.stepData.step1?.selectedAddress;
    if (!step1Address) return null;

    return (
      <div className="space-y-4">
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-purple-800 mb-2">
            Verificar Distrito
          </h4>
          
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border">
              <div className="text-sm space-y-2">
                <div>
                  <strong>Distrito Oficial:</strong> 
                  <span className="ml-2 font-mono text-blue-600">{step1Address.distrito}</span>
                </div>
                <div className="text-gray-600">
                  ¿Confirma que este es el distrito correcto?
                </div>
              </div>
              
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => executeStep(3, { confirmedDistrict: step1Address.distrito })}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                </button>
                
                <div className="flex items-center space-x-2">
                  <select
                    value={currentStepData.customDistrict || ''}
                    onChange={(e) => setCurrentStepData(prev => ({ ...prev, customDistrict: parseInt(e.target.value) }))}
                    className="px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Seleccionar distrito</option>
                    {Array.from({ length: 21 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => executeStep(3, { confirmedDistrict: currentStepData.customDistrict })}
                    disabled={loading || !currentStepData.customDistrict}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    Usar este
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    const step1Address = progress?.stepData.step1?.selectedAddress;
    if (!step1Address) return null;

    return (
      <div className="space-y-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-2">
            Verificar Coordenadas
          </h4>
          
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border">
              <div className="text-sm space-y-2">
                <div>
                  <strong>Coordenadas Oficiales:</strong>
                </div>
                <div className="ml-4 font-mono text-blue-600">
                  Lat: {step1Address.latitud?.toFixed(6) || 'No disponible'}<br/>
                  Lng: {step1Address.longitud?.toFixed(6) || 'No disponible'}
                </div>
                <div className="text-gray-600">
                  ¿Confirma que estas coordenadas son correctas?
                </div>
              </div>
              
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => executeStep(4, { 
                    confirmedCoordinates: { 
                      lat: step1Address.latitud || 0, 
                      lng: step1Address.longitud || 0 
                    } 
                  })}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                </button>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Latitud"
                    value={currentStepData.customLat || ''}
                    onChange={(e) => setCurrentStepData(prev => ({ ...prev, customLat: parseFloat(e.target.value) }))}
                    className="px-3 py-2 border rounded text-sm w-32"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Longitud"
                    value={currentStepData.customLng || ''}
                    onChange={(e) => setCurrentStepData(prev => ({ ...prev, customLng: parseFloat(e.target.value) }))}
                    className="px-3 py-2 border rounded text-sm w-32"
                  />
                  <button
                    onClick={() => executeStep(4, { 
                      confirmedCoordinates: { 
                        lat: currentStepData.customLat, 
                        lng: currentStepData.customLng 
                      } 
                    })}
                    disabled={loading || !currentStepData.customLat || !currentStepData.customLng}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    Usar estas
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    if (!progress) return null;

    switch (progress.currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return (
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <h4 className="font-semibold text-green-800">¡Validación Completada!</h4>
            <p className="text-green-600 text-sm">
              Todos los datos han sido verificados y guardados correctamente.
            </p>
          </div>
        );
    }
  };

  if (loading && !progress) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Inicializando validación...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <XCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
        <button
          onClick={initializeValidation}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Progreso Visual */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Validación Paso a Paso</h3>
          <span className="text-sm text-gray-500">
            {progress.isComplete ? 'Completado' : `Paso ${progress.currentStep} de ${progress.totalSteps}`}
          </span>
        </div>
        
        {/* Barra de Progreso */}
        <div className="space-y-3">
          {progress.steps.map((step, index) => (
            <div key={step.stepNumber} className="flex items-center space-x-3">
              {getStepIcon(step)}
              <div className="flex-1">
                <div className={`text-sm ${getStepColor(step)}`}>
                  {step.title}
                  {step.status === 'skipped' && step.skipReason && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({step.skipReason})
                    </span>
                  )}
                </div>
              </div>
              {step.status === 'completed' && (
                <span className="text-xs text-green-600">✓</span>
              )}
              {step.status === 'skipped' && (
                <span className="text-xs text-gray-500">Saltado</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dirección Original del Registro DEA - Siempre visible */}
      {step1Data?.originalRecord && (
        <div className="bg-white border rounded-lg p-4">
          <div className="font-medium text-gray-800 mb-3 flex items-center">
            <span className="text-lg mr-2">📋</span>
            Dirección Original del Registro DEA
          </div>
          <div className="bg-gray-50 p-3 rounded border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div><strong>Tipo de Vía:</strong> {step1Data.originalRecord.tipoVia}</div>
                <div><strong>Nombre de Vía:</strong> {step1Data.originalRecord.nombreVia}</div>
                {step1Data.originalRecord.numeroVia && (
                  <div><strong>Número:</strong> {step1Data.originalRecord.numeroVia}</div>
                )}
                {step1Data.originalRecord.complementoDireccion && (
                  <div><strong>Complemento:</strong> {step1Data.originalRecord.complementoDireccion}</div>
                )}
              </div>
              <div>
                <div><strong>Código Postal:</strong> {step1Data.originalRecord.codigoPostal}</div>
                <div><strong>Distrito:</strong> {step1Data.originalRecord.distrito}</div>
                <div className="mt-2 p-2 bg-white rounded border">
                  <div><strong>Coordenadas del Usuario:</strong></div>
                  <div className="font-mono text-xs">
                    Lat: {step1Data.originalRecord.latitud.toFixed(6)}<br/>
                    Lng: {step1Data.originalRecord.longitud.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paso Actual */}
      {!progress.isComplete && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold mr-3">
              {progress.currentStep}
            </div>
            <h4 className="font-semibold">
              {progress.steps.find(s => s.stepNumber === progress.currentStep)?.title}
            </h4>
          </div>
          
          {renderCurrentStep()}
        </div>
      )}

      {/* Resumen Final */}
      {progress.isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-2">Resumen de Validación</h4>
          <div className="text-sm space-y-1">
            {progress.stepData.step1 && (
              <div>✓ Dirección confirmada: {progress.stepData.step1.selectedAddress.tipoVia} {progress.stepData.step1.selectedAddress.nombreVia}</div>
            )}
            {progress.stepData.step2 && (
              <div>✓ Código postal: {progress.stepData.step2.confirmedPostalCode}</div>
            )}
            {progress.stepData.step3 && (
              <div>✓ Distrito: {progress.stepData.step3.confirmedDistrict}</div>
            )}
            {progress.stepData.step4 && (
              <div>✓ Coordenadas verificadas</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
