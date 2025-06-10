'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  MapPin, 
  FileText, 
  Hash,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  List
} from 'lucide-react';
import StepByStepValidation from './StepByStepValidation';

interface OrderedAddressValidation {
  step1_officialSearch: {
    found: boolean;
    exactMatch: boolean;
    officialData: {
      id: number;
      codVia: number;
      tipoVia: string;
      nombreVia: string;
      numeroVia: string | null;
      codigoPostal: string;
      distrito: number;
      latitud: number | null;
      longitud: number | null;
      confidence: number;
    } | null;
    alternatives: Array<{
      id: number;
      codVia: number;
      tipoVia: string;
      nombreVia: string;
      numeroVia: string | null;
      codigoPostal: string;
      distrito: number;
      latitud: number | null;
      longitud: number | null;
      confidence: number;
    }>;
    searchCriteria: {
      tipoVia: string;
      nombreVia: string;
      numeroVia: string | null;
    };
  };
  step2_verification: {
    nameNormalization: {
      userInput: {
        tipoVia: string;
        nombreVia: string;
      };
      official: {
        tipoVia: string;
        nombreVia: string;
      } | null;
      needsCorrection: boolean;
      suggestions: string[];
    };
    postalCodeMatch: {
      userInput: string;
      official: string | null;
      matches: boolean;
      needsCorrection: boolean;
    };
    districtMatch: {
      userInput: string;
      userInputNumber: number;
      official: number | null;
      matches: boolean;
      needsCorrection: boolean;
    };
  };
  overallResult: {
    isValid: boolean;
    needsReview: boolean;
    corrections: string[];
    confidence: number;
    recommendedActions: string[];
  };
}

interface DeaValidationResult {
  id: number;
  orderedAddressValidation: OrderedAddressValidation;
  geographic: {
    originalData: {
      tipoVia: string;
      nombreVia: string;
      numeroVia: string | null;
      complementoDireccion: string | null;
      codigoPostal: number;
      distrito: string;
      distritoNumero: number;
      latitud: number;
      longitud: number;
    };
    validation: {
      postalCodeMatch: boolean;
      districtMatch: boolean;
      coordinatesDistance: number | null;
      coordinatesValid: boolean;
      suggestedData: {
        codPostal?: string;
        distrito?: number;
        latitud?: number;
        longitud?: number;
        viaNombreAcentos?: string;
      };
    };
    needsReview: boolean;
    suggestions: string[];
  };
  textFields: {
    titularidad: {
      original: string;
      normalized: string;
      changes: string[];
      needsReview: boolean;
    };
    propuestaDenominacion: {
      original: string;
      normalized: string;
      changes: string[];
      needsReview: boolean;
    };
    nombreVia: {
      original: string;
      normalized: string;
      changes: string[];
      needsReview: boolean;
    };
  };
  deaCode: {
    generated: {
      codigo: string;
      distrito: number;
      codigoPostal: string;
      secuencial: number;
      isValid: boolean;
      errors: string[];
    } | null;
    needsGeneration: boolean;
    currentCode: string | null;
  };
  overallStatus: 'valid' | 'needs_review' | 'invalid';
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warnings: number;
    suggestions: string[];
  };
}

interface DeaValidationPanelProps {
  deaRecordId: number;
  onValidationComplete?: (result: DeaValidationResult) => void;
}

export default function DeaValidationPanel({ 
  deaRecordId, 
  onValidationComplete 
}: DeaValidationPanelProps) {
  const [validation, setValidation] = useState<DeaValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationMode, setValidationMode] = useState<'complete' | 'step-by-step'>('complete');
  const [selectedCorrections, setSelectedCorrections] = useState({
    applyGeographic: false,
    applyTextNormalization: false,
    applyDeaCode: false
  });
  const [editMode, setEditMode] = useState({
    geographic: false,
    textFields: false as string | false
  });
  const [manualEdits, setManualEdits] = useState({
    codPostal: '',
    distrito: '',
    latitud: '',
    longitud: '',
    titularidad: '',
    propuestaDenominacion: '',
    tipoVia: '',
    nombreVia: ''
  });

  useEffect(() => {
    loadValidation();
  }, [deaRecordId]);

  const loadValidation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/dea/${deaRecordId}/validate`);
      const data = await response.json();
      
      if (data.success) {
        setValidation(data.data);
        // NO llamar onValidationComplete automáticamente
        // Solo se llamará cuando el usuario haga clic en "Continuar"
      } else {
        const errorMessage = data.error || 'Error cargando validación';
        console.error('Error en validación:', data);
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Error de conexión en validación:', err);
      setError('Error de conexión. Verifique que el servidor esté funcionando.');
    } finally {
      setLoading(false);
    }
  };

  const applyCorrections = async () => {
    if (!validation) return;
    
    setApplying(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/dea/${deaRecordId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(selectedCorrections)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Recargar validación después de aplicar correcciones
        await loadValidation();
        setSelectedCorrections({
          applyGeographic: false,
          applyTextNormalization: false,
          applyDeaCode: false
        });
      } else {
        setError(data.error || 'Error aplicando correcciones');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setApplying(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'needs_review':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'invalid':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'needs_review':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'invalid':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Validando registro...</span>
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
          onClick={loadValidation}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!validation) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Estado General y Selector de Modo */}
      <div className={`p-4 border rounded-lg ${getStatusColor(validation.overallStatus)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {getStatusIcon(validation.overallStatus)}
            <div className="ml-3">
              <h3 className="font-semibold">
                Estado de Validación
              </h3>
              <p className="text-sm">
                {validation.summary.totalIssues === 0 
                  ? 'Registro completamente validado'
                  : `${validation.summary.criticalIssues} problemas críticos, ${validation.summary.warnings} advertencias`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Selector de Modo de Validación */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setValidationMode('complete')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  validationMode === 'complete'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-1" />
                Completa
              </button>
              <button
                onClick={() => setValidationMode('step-by-step')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  validationMode === 'step-by-step'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <List className="w-4 h-4 inline mr-1" />
                Paso a Paso
              </button>
            </div>
            <button
              onClick={loadValidation}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 rounded"
              title="Recargar validación"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Contenido según el modo seleccionado */}
      {validationMode === 'step-by-step' ? (
        <StepByStepValidation 
          deaRecordId={deaRecordId}
          onComplete={(progress) => {
            // Recargar validación después de completar paso a paso
            loadValidation();
            // Llamar al callback si existe
            onValidationComplete?.(validation);
          }}
        />
      ) : (
        <>

      {/* Validación Ordenada de Direcciones */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center mb-3">
          <MapPin className="w-5 h-5 text-indigo-500 mr-2" />
          <h4 className="font-semibold">Validación Ordenada de Direcciones</h4>
          {validation.orderedAddressValidation.overallResult.needsReview && (
            <AlertTriangle className="w-4 h-4 text-yellow-500 ml-2" />
          )}
        </div>

        {/* Paso 1: Búsqueda en Base de Datos Oficial */}
        <div className="mb-4">
          <h5 className="font-medium text-gray-800 mb-2">1º Paso: Búsqueda en Base de Datos Oficial</h5>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              {validation.orderedAddressValidation.step1_officialSearch.found ? (
                validation.orderedAddressValidation.step1_officialSearch.exactMatch ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
                )
              ) : (
                <XCircle className="w-4 h-4 text-red-500 mr-2" />
              )}
              <span className="font-medium">
                {validation.orderedAddressValidation.step1_officialSearch.found 
                  ? validation.orderedAddressValidation.step1_officialSearch.exactMatch 
                    ? 'Dirección encontrada (coincidencia exacta)'
                    : 'Dirección encontrada (coincidencia aproximada)'
                  : 'Dirección no encontrada'
                }
              </span>
            </div>
            
            <div className="ml-6 space-y-2 text-sm">
              <div className="text-gray-600">
                <strong>Búsqueda:</strong> {validation.orderedAddressValidation.step1_officialSearch.searchCriteria.tipoVia} {validation.orderedAddressValidation.step1_officialSearch.searchCriteria.nombreVia}
                {validation.orderedAddressValidation.step1_officialSearch.searchCriteria.numeroVia && 
                  `, ${validation.orderedAddressValidation.step1_officialSearch.searchCriteria.numeroVia}`
                }
              </div>
              
              {validation.orderedAddressValidation.step1_officialSearch.officialData && (
                <div className="bg-white p-2 rounded border">
                  <div className="text-blue-600 font-medium">Datos Oficiales Encontrados:</div>
                  <div className="text-gray-700">
                    <strong>Dirección:</strong> {validation.orderedAddressValidation.step1_officialSearch.officialData.tipoVia} {validation.orderedAddressValidation.step1_officialSearch.officialData.nombreVia}
                    {validation.orderedAddressValidation.step1_officialSearch.officialData.numeroVia && 
                      `, ${validation.orderedAddressValidation.step1_officialSearch.officialData.numeroVia}`
                    }
                  </div>
                  <div className="text-gray-700">
                    <strong>Código Postal:</strong> {validation.orderedAddressValidation.step1_officialSearch.officialData.codigoPostal}
                  </div>
                  <div className="text-gray-700">
                    <strong>Distrito:</strong> {validation.orderedAddressValidation.step1_officialSearch.officialData.distrito}
                  </div>
                  <div className="text-gray-700">
                    <strong>Confianza:</strong> {(validation.orderedAddressValidation.step1_officialSearch.officialData.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              )}

              {validation.orderedAddressValidation.step1_officialSearch.alternatives.length > 0 && (
                <div className="mt-2">
                  <div className="text-gray-600 font-medium">Alternativas encontradas:</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {validation.orderedAddressValidation.step1_officialSearch.alternatives.slice(0, 3).map((alt, index) => (
                      <div key={index} className="bg-yellow-50 p-2 rounded text-xs">
                        <div>{alt.tipoVia} {alt.nombreVia}{alt.numeroVia && `, ${alt.numeroVia}`}</div>
                        <div className="text-gray-600">CP: {alt.codigoPostal}, Distrito: {alt.distrito} (Confianza: {(alt.confidence * 100).toFixed(1)}%)</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Paso 2: Verificación y Normalización */}
        <div className="mb-4">
          <h5 className="font-medium text-gray-800 mb-2">2º Paso: Verificación y Normalización</h5>
          
          {/* Normalización del Nombre */}
          <div className="bg-gray-50 p-3 rounded-lg mb-3">
            <div className="flex items-center mb-2">
              {validation.orderedAddressValidation.step2_verification.nameNormalization.needsCorrection ? (
                <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
              )}
              <span className="font-medium">Normalización del Nombre de Vía</span>
            </div>
            <div className="ml-6 space-y-1 text-sm">
              <div className="text-gray-600">
                <strong>Escrito a mano:</strong> {validation.orderedAddressValidation.step2_verification.nameNormalization.userInput.tipoVia} {validation.orderedAddressValidation.step2_verification.nameNormalization.userInput.nombreVia}
              </div>
              {validation.orderedAddressValidation.step2_verification.nameNormalization.official && (
                <div className="text-blue-600">
                  <strong>Nombre oficial:</strong> {validation.orderedAddressValidation.step2_verification.nameNormalization.official.tipoVia} {validation.orderedAddressValidation.step2_verification.nameNormalization.official.nombreVia}
                </div>
              )}
              <div className={`${validation.orderedAddressValidation.step2_verification.nameNormalization.needsCorrection ? 'text-yellow-600' : 'text-green-600'}`}>
                <strong>Estado:</strong> {validation.orderedAddressValidation.step2_verification.nameNormalization.needsCorrection ? 'Necesita corrección' : 'Correcto'}
              </div>
              {validation.orderedAddressValidation.step2_verification.nameNormalization.suggestions.length > 0 && (
                <div className="text-blue-600 text-xs">
                  <strong>Sugerencias:</strong> {validation.orderedAddressValidation.step2_verification.nameNormalization.suggestions.join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Verificación Código Postal */}
          <div className="bg-gray-50 p-3 rounded-lg mb-3">
            <div className="flex items-center mb-2">
              {validation.orderedAddressValidation.step2_verification.postalCodeMatch.matches ? (
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 mr-2" />
              )}
              <span className="font-medium">Verificación Código Postal</span>
            </div>
            <div className="ml-6 space-y-1 text-sm">
              <div className="text-gray-600">
                <strong>Escrito a mano:</strong> <span className="font-mono">{validation.orderedAddressValidation.step2_verification.postalCodeMatch.userInput}</span>
              </div>
              {validation.orderedAddressValidation.step2_verification.postalCodeMatch.official && (
                <div className="text-blue-600">
                  <strong>Código oficial:</strong> <span className="font-mono">{validation.orderedAddressValidation.step2_verification.postalCodeMatch.official}</span>
                </div>
              )}
              <div className={`${validation.orderedAddressValidation.step2_verification.postalCodeMatch.matches ? 'text-green-600' : 'text-red-600'}`}>
                <strong>Estado:</strong> {validation.orderedAddressValidation.step2_verification.postalCodeMatch.matches ? 'Coincide' : 'No coincide'}
              </div>
            </div>
          </div>

          {/* Verificación Distrito */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              {validation.orderedAddressValidation.step2_verification.districtMatch.matches ? (
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 mr-2" />
              )}
              <span className="font-medium">Verificación Distrito</span>
            </div>
            <div className="ml-6 space-y-1 text-sm">
              <div className="text-gray-600">
                <strong>Escrito a mano:</strong> {validation.orderedAddressValidation.step2_verification.districtMatch.userInput} (Número: {validation.orderedAddressValidation.step2_verification.districtMatch.userInputNumber})
              </div>
              {validation.orderedAddressValidation.step2_verification.districtMatch.official && (
                <div className="text-blue-600">
                  <strong>Distrito oficial:</strong> {validation.orderedAddressValidation.step2_verification.districtMatch.official}
                </div>
              )}
              <div className={`${validation.orderedAddressValidation.step2_verification.districtMatch.matches ? 'text-green-600' : 'text-red-600'}`}>
                <strong>Estado:</strong> {validation.orderedAddressValidation.step2_verification.districtMatch.matches ? 'Coincide' : 'No coincide'}
              </div>
            </div>
          </div>
        </div>

        {/* Resultado General de la Validación Ordenada */}
        <div className={`p-3 rounded-lg border-l-4 ${
          validation.orderedAddressValidation.overallResult.isValid 
            ? 'bg-green-50 border-green-400' 
            : validation.orderedAddressValidation.overallResult.needsReview
              ? 'bg-yellow-50 border-yellow-400'
              : 'bg-red-50 border-red-400'
        }`}>
          <div className="flex items-center mb-2">
            {validation.orderedAddressValidation.overallResult.isValid ? (
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            ) : validation.orderedAddressValidation.overallResult.needsReview ? (
              <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
            )}
            <span className="font-medium">
              Resultado de Validación Ordenada (Confianza: {(validation.orderedAddressValidation.overallResult.confidence * 100).toFixed(1)}%)
            </span>
          </div>
          
          {validation.orderedAddressValidation.overallResult.corrections.length > 0 && (
            <div className="ml-7 mb-2">
              <div className="text-sm font-medium text-gray-700 mb-1">Correcciones necesarias:</div>
              <ul className="text-sm space-y-1">
                {validation.orderedAddressValidation.overallResult.corrections.map((correction, index) => (
                  <li key={index} className="flex items-start">
                    <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {correction}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validation.orderedAddressValidation.overallResult.recommendedActions.length > 0 && (
            <div className="ml-7">
              <div className="text-sm font-medium text-gray-700 mb-1">Acciones recomendadas:</div>
              <ul className="text-sm space-y-1">
                {validation.orderedAddressValidation.overallResult.recommendedActions.map((action, index) => (
                  <li key={index} className="flex items-start">
                    <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Validación Geográfica */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center mb-3">
          <MapPin className="w-5 h-5 text-blue-500 mr-2" />
          <h4 className="font-semibold">Validación Geográfica (Sistema Anterior)</h4>
          {validation.geographic.needsReview && (
            <AlertTriangle className="w-4 h-4 text-yellow-500 ml-2" />
          )}
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              {validation.geographic.validation.postalCodeMatch ? (
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 mr-2" />
              )}
              <span className="font-medium">Código Postal</span>
            </div>
            <div className="ml-6 space-y-1">
              <div className="text-gray-600">Original: <span className="font-mono">{validation.geographic.originalData?.codigoPostal || 'No disponible'}</span></div>
              <div className="text-blue-600">
                Base de datos: <span className="font-mono">
                  {validation.geographic.validation.suggestedData.codPostal || 'No encontrado'}
                </span>
              </div>
              <div className={`${validation.geographic.validation.postalCodeMatch ? 'text-green-600' : 'text-red-600'}`}>
                Estado: {validation.geographic.validation.postalCodeMatch ? 'Coincide' : 'No coincide'}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              {validation.geographic.validation.districtMatch ? (
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 mr-2" />
              )}
              <span className="font-medium">Distrito</span>
            </div>
            <div className="ml-6 space-y-1">
              <div className="text-gray-600">Original: <span className="font-mono">{validation.geographic.originalData?.distrito || 'No disponible'}</span></div>
              <div className="text-blue-600">
                Base de datos: <span className="font-mono">
                  {validation.geographic.validation.suggestedData.distrito || 'No encontrado'}
                </span>
              </div>
              <div className={`${validation.geographic.validation.districtMatch ? 'text-green-600' : 'text-red-600'}`}>
                Estado: {validation.geographic.validation.districtMatch ? 'Coincide' : 'No coincide'}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              {validation.geographic.validation.coordinatesValid ? (
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
              )}
              <span className="font-medium">Coordenadas</span>
            </div>
            <div className="ml-6 space-y-1">
              <div className="text-gray-600">
                Originales: <span className="font-mono">
                  {validation.geographic.originalData?.latitud && validation.geographic.originalData?.longitud 
                    ? `${validation.geographic.originalData.latitud.toFixed(6)}, ${validation.geographic.originalData.longitud.toFixed(6)}`
                    : 'No disponibles'
                  }
                </span>
              </div>
              {validation.geographic.validation.suggestedData.latitud && validation.geographic.validation.suggestedData.longitud && (
                <div className="text-blue-600">
                  Base de datos: <span className="font-mono">
                    {validation.geographic.validation.suggestedData.latitud.toFixed(6)}, {validation.geographic.validation.suggestedData.longitud.toFixed(6)}
                  </span>
                </div>
              )}
              {validation.geographic.validation.coordinatesDistance && (
                <div className="text-orange-600">
                  Distancia: <span className="font-mono">{(validation.geographic.validation.coordinatesDistance * 1000).toFixed(0)}m</span>
                </div>
              )}
              <div className={`${validation.geographic.validation.coordinatesValid ? 'text-green-600' : 'text-yellow-600'}`}>
                Estado: {validation.geographic.validation.coordinatesValid ? 'Válidas (< 20m)' : 'Revisar (> 20m)'}
              </div>
            </div>
          </div>
        </div>

        {validation.geographic.needsReview && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedCorrections.applyGeographic}
                  onChange={(e) => setSelectedCorrections(prev => ({
                    ...prev,
                    applyGeographic: e.target.checked
                  }))}
                  className="mr-2"
                />
                <span className="text-sm">Aplicar correcciones geográficas automáticas</span>
              </label>
              <button
                onClick={() => setEditMode(prev => ({ ...prev, geographic: !prev.geographic }))}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {editMode.geographic ? 'Cancelar edición' : 'Editar manualmente'}
              </button>
            </div>

            {editMode.geographic && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <h5 className="font-medium text-gray-800">Edición Manual de Datos Geográficos</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código Postal
                    </label>
                    <input
                      type="text"
                      value={manualEdits.codPostal}
                      onChange={(e) => setManualEdits(prev => ({ ...prev, codPostal: e.target.value }))}
                      placeholder={validation.geographic.validation.suggestedData.codPostal || "Código postal"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Distrito
                    </label>
                    <input
                      type="number"
                      value={manualEdits.distrito}
                      onChange={(e) => setManualEdits(prev => ({ ...prev, distrito: e.target.value }))}
                      placeholder={validation.geographic.validation.suggestedData.distrito?.toString() || "Distrito"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Latitud
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={manualEdits.latitud}
                      onChange={(e) => setManualEdits(prev => ({ ...prev, latitud: e.target.value }))}
                      placeholder={validation.geographic.validation.suggestedData.latitud?.toString() || "Latitud"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longitud
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={manualEdits.longitud}
                      onChange={(e) => setManualEdits(prev => ({ ...prev, longitud: e.target.value }))}
                      placeholder={validation.geographic.validation.suggestedData.longitud?.toString() || "Longitud"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setManualEdits(prev => ({
                        ...prev,
                        codPostal: validation.geographic.validation.suggestedData.codPostal || '',
                        distrito: validation.geographic.validation.suggestedData.distrito?.toString() || '',
                        latitud: validation.geographic.validation.suggestedData.latitud?.toString() || '',
                        longitud: validation.geographic.validation.suggestedData.longitud?.toString() || ''
                      }));
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Usar sugerencias
                  </button>
                  <button
                    onClick={() => {
                      // Aquí iría la lógica para guardar los cambios manuales
                      console.log('Guardando cambios manuales:', manualEdits);
                      setEditMode(prev => ({ ...prev, geographic: false }));
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Guardar cambios
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Normalización de Texto */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center mb-3">
          <FileText className="w-5 h-5 text-green-500 mr-2" />
          <h4 className="font-semibold">Normalización de Texto</h4>
        </div>
        
        <div className="space-y-3">
          {Object.entries(validation.textFields).map(([field, data]) => (
            <div key={field} className="border-l-2 border-gray-200 pl-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="font-medium text-sm capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  {data.needsReview && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 ml-2" />
                  )}
                </div>
                {(data.original !== data.normalized || data.needsReview) && (
                  <button
                    onClick={() => setEditMode(prev => ({ 
                      ...prev, 
                      textFields: prev.textFields === field ? false : field 
                    }))}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    {editMode.textFields === field ? 'Cancelar' : 'Editar'}
                  </button>
                )}
              </div>
              
              {editMode.textFields === field ? (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={manualEdits[field as keyof typeof manualEdits] || data.original}
                    onChange={(e) => setManualEdits(prev => ({ 
                      ...prev, 
                      [field]: e.target.value 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={data.normalized}
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setManualEdits(prev => ({ ...prev, [field]: data.normalized }));
                      }}
                      className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Usar sugerencia
                    </button>
                    <button
                      onClick={() => {
                        console.log(`Guardando ${field}:`, manualEdits[field as keyof typeof manualEdits]);
                        setEditMode(prev => ({ ...prev, textFields: false }));
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                data.original !== data.normalized && (
                  <div className="mt-1 text-sm">
                    <div className="text-gray-600">Original: {data.original}</div>
                    <div className="text-green-600">Normalizado: {data.normalized}</div>
                    {data.changes.length > 0 && (
                      <div className="text-blue-600 text-xs">
                        Cambios: {data.changes.join(', ')}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ))}
        </div>

        {(Object.values(validation.textFields).some(field => field.original !== field.normalized) || 
          validation.summary.criticalIssues > 0 || validation.summary.warnings > 0) && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedCorrections.applyTextNormalization}
                  onChange={(e) => setSelectedCorrections(prev => ({
                    ...prev,
                    applyTextNormalization: e.target.checked
                  }))}
                  className="mr-2"
                />
                <span className="text-sm">Aplicar normalización de texto automática</span>
              </label>
              <button
                onClick={() => setEditMode(prev => ({ ...prev, textFields: prev.textFields ? false : 'general' }))}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {editMode.textFields ? 'Cancelar edición' : 'Editar manualmente'}
              </button>
            </div>

            {editMode.textFields && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h5 className="font-medium text-gray-800">Edición Manual de Campos de Texto</h5>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Titularidad
                    </label>
                    <input
                      type="text"
                      value={manualEdits.titularidad}
                      onChange={(e) => setManualEdits(prev => ({ ...prev, titularidad: e.target.value }))}
                      placeholder={validation.textFields.titularidad.normalized || validation.textFields.titularidad.original}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {validation.textFields.titularidad.original !== validation.textFields.titularidad.normalized && (
                      <div className="mt-1 text-xs text-gray-600">
                        Original: {validation.textFields.titularidad.original} → 
                        Sugerido: {validation.textFields.titularidad.normalized}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Propuesta de Denominación
                    </label>
                    <input
                      type="text"
                      value={manualEdits.propuestaDenominacion}
                      onChange={(e) => setManualEdits(prev => ({ ...prev, propuestaDenominacion: e.target.value }))}
                      placeholder={validation.textFields.propuestaDenominacion.normalized || validation.textFields.propuestaDenominacion.original}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {validation.textFields.propuestaDenominacion.original !== validation.textFields.propuestaDenominacion.normalized && (
                      <div className="mt-1 text-xs text-gray-600">
                        Original: {validation.textFields.propuestaDenominacion.original} → 
                        Sugerido: {validation.textFields.propuestaDenominacion.normalized}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Vía
                      </label>
                      <select
                        value={manualEdits.tipoVia}
                        onChange={(e) => setManualEdits(prev => ({ ...prev, tipoVia: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar tipo</option>
                        <option value="Calle">Calle</option>
                        <option value="Avenida">Avenida</option>
                        <option value="Plaza">Plaza</option>
                        <option value="Paseo">Paseo</option>
                        <option value="Glorieta">Glorieta</option>
                        <option value="Ronda">Ronda</option>
                        <option value="Travesía">Travesía</option>
                        <option value="Callejón">Callejón</option>
                        <option value="Camino">Camino</option>
                        <option value="Carretera">Carretera</option>
                        <option value="Costanilla">Costanilla</option>
                        <option value="Cuesta">Cuesta</option>
                        <option value="Pasaje">Pasaje</option>
                        <option value="Vía">Vía</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre de la Vía
                      </label>
                      <input
                        type="text"
                        value={manualEdits.nombreVia}
                        onChange={(e) => setManualEdits(prev => ({ ...prev, nombreVia: e.target.value }))}
                        placeholder="Nombre de la vía (sin tipo)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  {validation.textFields.nombreVia.original !== validation.textFields.nombreVia.normalized && (
                    <div className="mt-1 text-xs text-gray-600">
                      Original: {validation.textFields.nombreVia.original} → 
                      Sugerido: {validation.textFields.nombreVia.normalized}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setManualEdits(prev => ({
                        ...prev,
                        titularidad: validation.textFields.titularidad.normalized,
                        propuestaDenominacion: validation.textFields.propuestaDenominacion.normalized,
                        nombreVia: validation.textFields.nombreVia.normalized
                      }));
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Usar sugerencias
                  </button>
                  <button
                    onClick={() => {
                      // Aquí iría la lógica para guardar los cambios manuales de texto
                      console.log('Guardando cambios manuales de texto:', manualEdits);
                      setEditMode(prev => ({ ...prev, textFields: false }));
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Guardar cambios
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Código DEA */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center mb-3">
          <Hash className="w-5 h-5 text-purple-500 mr-2" />
          <h4 className="font-semibold">Código DEA</h4>
        </div>
        
        <div className="space-y-2 text-sm">
          {validation.deaCode.currentCode ? (
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
              <span>Código actual: {validation.deaCode.currentCode}</span>
            </div>
          ) : (
            <div className="flex items-center">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
              <span>Sin código asignado</span>
            </div>
          )}
          
          {validation.deaCode.generated && (
            <div className="mt-2 p-2 bg-blue-50 rounded">
              <div className="font-medium text-blue-800">Código generado:</div>
              <div className="text-blue-700">{validation.deaCode.generated.codigo}</div>
              <div className="text-xs text-blue-600">
                Distrito: {validation.deaCode.generated.distrito}, 
                CP: {validation.deaCode.generated.codigoPostal}, 
                Secuencial: {validation.deaCode.generated.secuencial}
              </div>
            </div>
          )}
        </div>

        {validation.deaCode.needsGeneration && validation.deaCode.generated?.isValid && (
          <div className="mt-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedCorrections.applyDeaCode}
                onChange={(e) => setSelectedCorrections(prev => ({
                  ...prev,
                  applyDeaCode: e.target.checked
                }))}
                className="mr-2"
              />
              <span className="text-sm">Asignar código DEA generado</span>
            </label>
          </div>
        )}
      </div>

      {/* Botones de Acción */}
      <div className="flex justify-between items-center">
        {(selectedCorrections.applyGeographic || 
          selectedCorrections.applyTextNormalization || 
          selectedCorrections.applyDeaCode) && (
          <button
            onClick={applyCorrections}
            disabled={applying}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {applying ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {applying ? 'Aplicando...' : 'Aplicar Correcciones'}
          </button>
        )}
        
        <button
          onClick={() => onValidationComplete?.(validation)}
          className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 ml-auto"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Continuar con Verificación
        </button>
      </div>

      {/* Resumen de Sugerencias */}
      {validation.summary.suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h5 className="font-semibold text-blue-800 mb-2">Sugerencias:</h5>
          <ul className="text-sm text-blue-700 space-y-1">
            {validation.summary.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start">
                <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
        </>
      )}
    </div>
  );
}
