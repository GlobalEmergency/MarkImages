/**
 * Value Object: Definición de un campo del sistema
 * Define qué campos se pueden mapear desde el CSV
 * Capa de Dominio
 */

export type FieldType = 'string' | 'number' | 'boolean' | 'url' | 'email';

export interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
  type: FieldType;
  description?: string;
  examples?: string[];
  validator?: (value: string) => boolean;
}

/**
 * Campos requeridos del sistema
 * Estos DEBEN ser mapeados para una importación válida
 */
export const REQUIRED_FIELDS: FieldDefinition[] = [
  {
    key: 'proposedName',
    label: 'Nombre propuesto',
    required: true,
    type: 'string',
    description: 'Nombre del establecimiento donde está el DEA',
    examples: ['Hospital General', 'Centro Comercial Plaza', 'Ayuntamiento'],
  },
  {
    key: 'district',
    label: 'Distrito',
    required: true,
    type: 'string',
    description: 'Distrito de Madrid donde se ubica el DEA',
    examples: ['Centro', '1. Centro', 'Retiro', '3. Retiro'],
  },
  {
    key: 'streetName',
    label: 'Nombre de la vía',
    required: true,
    type: 'string',
    description: 'Nombre de la calle o vía',
    examples: ['Gran Vía', 'Calle Mayor', 'Paseo de la Castellana'],
  },
  {
    key: 'streetNumber',
    label: 'Número de la vía',
    required: true,
    type: 'string',
    description: 'Número del portal',
    examples: ['1', '25', '123 bis'],
  },
];

/**
 * Campos opcionales del sistema
 * Mejoran la información pero no son obligatorios
 */
export const OPTIONAL_FIELDS: FieldDefinition[] = [
  {
    key: 'submitterEmail',
    label: 'Correo electrónico',
    required: false,
    type: 'email',
    description: 'Email del responsable',
    examples: ['admin@hospital.com'],
  },
  {
    key: 'submitterName',
    label: 'Nombre del responsable',
    required: false,
    type: 'string',
    description: 'Nombre de la persona responsable',
  },
  {
    key: 'provisionalNumber',
    label: 'Número provisional DEA',
    required: false,
    type: 'string',
    description: 'Número provisional asignado',
  },
  {
    key: 'establishmentType',
    label: 'Tipo de establecimiento',
    required: false,
    type: 'string',
    description: 'Tipo de establecimiento',
    examples: ['Hospital', 'Centro deportivo', 'Centro comercial'],
  },
  {
    key: 'streetType',
    label: 'Tipo de vía',
    required: false,
    type: 'string',
    description: 'Tipo de vía (calle, avenida, plaza, etc.)',
    examples: ['Calle', 'Avenida', 'Plaza', 'Paseo'],
  },
  {
    key: 'additionalInfo',
    label: 'Complemento de dirección',
    required: false,
    type: 'string',
    description: 'Información adicional de la dirección',
    examples: ['Edificio A', 'Local 3', 'Planta 2'],
  },
  {
    key: 'postalCode',
    label: 'Código postal',
    required: false,
    type: 'string',
    description: 'Código postal de 5 dígitos',
    examples: ['28001', '28013', '28080'],
  },
  {
    key: 'latitude',
    label: 'Latitud',
    required: false,
    type: 'number',
    description: 'Coordenada de latitud (formato decimal)',
    examples: ['40.4168', '40.416775'],
  },
  {
    key: 'longitude',
    label: 'Longitud',
    required: false,
    type: 'number',
    description: 'Coordenada de longitud (formato decimal, negativa para oeste)',
    examples: ['-3.7038', '-3.703790'],
  },
  {
    key: 'photo1Url',
    label: 'Foto 1 (URL)',
    required: false,
    type: 'url',
    description: 'URL de la primera foto',
  },
  {
    key: 'photo2Url',
    label: 'Foto 2 (URL)',
    required: false,
    type: 'url',
    description: 'URL de la segunda foto',
  },
  {
    key: 'accessDescription',
    label: 'Descripción del acceso',
    required: false,
    type: 'string',
    description: 'Cómo acceder al DEA',
  },
  {
    key: 'scheduleDescription',
    label: 'Horario de apertura',
    required: false,
    type: 'string',
    description: 'Descripción general del horario',
  },
  {
    key: 'weekdayOpening',
    label: 'Hora apertura lunes-viernes',
    required: false,
    type: 'string',
    description: 'Hora de apertura entre semana (HH:MM)',
    examples: ['09:00', '08:30'],
  },
  {
    key: 'weekdayClosing',
    label: 'Hora cierre lunes-viernes',
    required: false,
    type: 'string',
    description: 'Hora de cierre entre semana (HH:MM)',
    examples: ['18:00', '20:00'],
  },
  {
    key: 'saturdayOpening',
    label: 'Hora apertura sábados',
    required: false,
    type: 'string',
    description: 'Hora de apertura los sábados (HH:MM)',
  },
  {
    key: 'saturdayClosing',
    label: 'Hora cierre sábados',
    required: false,
    type: 'string',
    description: 'Hora de cierre los sábados (HH:MM)',
  },
  {
    key: 'sundayOpening',
    label: 'Hora apertura domingos',
    required: false,
    type: 'string',
    description: 'Hora de apertura los domingos (HH:MM)',
  },
  {
    key: 'sundayClosing',
    label: 'Hora cierre domingos',
    required: false,
    type: 'string',
    description: 'Hora de cierre los domingos (HH:MM)',
  },
  {
    key: 'has24hSurveillance',
    label: '¿Vigilancia 24h?',
    required: false,
    type: 'boolean',
    description: 'Si tiene vigilancia 24 horas',
    examples: ['Sí', 'No', 'Si', 'true', 'false'],
  },
  {
    key: 'ownership',
    label: 'Titularidad',
    required: false,
    type: 'string',
    description: 'Titularidad del DEA',
  },
  {
    key: 'localOwnership',
    label: 'Titularidad del local',
    required: false,
    type: 'string',
    description: 'Titularidad del establecimiento',
  },
  {
    key: 'localUse',
    label: 'Uso del local',
    required: false,
    type: 'string',
    description: 'Uso del establecimiento',
  },
];

/**
 * Obtiene todos los campos (requeridos + opcionales)
 */
export function getAllFields(): FieldDefinition[] {
  return [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
}

/**
 * Busca un campo por su key
 */
export function getFieldByKey(key: string): FieldDefinition | undefined {
  return getAllFields().find((field) => field.key === key);
}

/**
 * Valida si un campo es requerido
 */
export function isRequiredField(key: string): boolean {
  return REQUIRED_FIELDS.some((field) => field.key === key);
}
