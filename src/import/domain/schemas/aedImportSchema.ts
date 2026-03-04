/**
 * AED Import Schema for @batchactions/import
 *
 * Define la estructura de validaciÃ³n de los campos de importaciÃ³n de DEAs.
 * Traduce las FieldDefinition existentes al formato SchemaDefinition de @batchactions/import.
 * Los aliases se extraen de las keywords de FieldDefinition para matching exacto.
 * El auto-mapeo fuzzy sigue siendo responsabilidad de ColumnMappingService.
 */

import type { SchemaDefinition, ValidationFieldResult } from "@batchactions/import";
import {
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  type FieldDefinition,
} from "../value-objects/FieldDefinition";

// ============================================================
// Custom validators reutilizables
// ============================================================

/**
 * Valida formato de cÃ³digo postal espaÃ±ol (5 dÃ­gitos)
 */
function validatePostalCode(value: unknown): ValidationFieldResult {
  const str = String(value).trim();
  if (!str) return { valid: true }; // VacÃ­o es vÃ¡lido (campo opcional)

  if (str.length !== 5 || !/^\d{5}$/.test(str)) {
    return {
      valid: false,
      message: `El cÃ³digo postal "${str}" debe tener exactamente 5 dÃ­gitos numÃ©ricos`,
      severity: "warning",
      suggestion: "Los cÃ³digos postales espaÃ±oles tienen 5 dÃ­gitos (ej: 28001, 28042)",
      metadata: { value: str, expectedFormat: "DDDDD" },
    };
  }
  return { valid: true };
}

/**
 * Valida latitud: rango -90 a 90, acepta coma como separador decimal
 */
function validateLatitude(value: unknown): ValidationFieldResult {
  const str = String(value).trim();
  if (!str) return { valid: true }; // VacÃ­o es vÃ¡lido (campo opcional)

  const normalized = str.replace(/,/g, ".");
  const num = parseFloat(normalized);

  if (isNaN(num)) {
    return {
      valid: false,
      message: `La latitud "${str}" no es un nÃºmero vÃ¡lido`,
      severity: "error",
      suggestion:
        "Usa formato decimal con punto (ej: 40.4165). Si usas coma, se convertirÃ¡ automÃ¡ticamente.",
    };
  }

  if (num < -90 || num > 90) {
    return {
      valid: false,
      message: `La latitud ${num} estÃ¡ fuera del rango vÃ¡lido (-90 a 90)`,
      severity: "error",
      suggestion: "Para Madrid, la latitud debe estar cerca de 40.4",
      metadata: { value: num, min: -90, max: 90 },
    };
  }

  return { valid: true };
}

/**
 * Valida longitud: rango -180 a 180, acepta coma como separador decimal
 */
function validateLongitude(value: unknown): ValidationFieldResult {
  const str = String(value).trim();
  if (!str) return { valid: true };

  const normalized = str.replace(/,/g, ".");
  const num = parseFloat(normalized);

  if (isNaN(num)) {
    return {
      valid: false,
      message: `La longitud "${str}" no es un nÃºmero vÃ¡lido`,
      severity: "error",
      suggestion:
        "Usa formato decimal con punto (ej: -3.7038). Si usas coma, se convertirÃ¡ automÃ¡ticamente.",
    };
  }

  if (num < -180 || num > 180) {
    return {
      valid: false,
      message: `La longitud ${num} estÃ¡ fuera del rango vÃ¡lido (-180 a 180)`,
      severity: "error",
      suggestion: "Para Madrid, la longitud debe estar cerca de -3.7",
      metadata: { value: num, min: -180, max: 180 },
    };
  }

  return { valid: true };
}

/**
 * Valida formato de hora HH:MM
 */
function validateTimeFormat(value: unknown): ValidationFieldResult {
  const str = String(value).trim();
  if (!str) return { valid: true };

  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(str)) {
    return {
      valid: false,
      message: `"${str}" no tiene formato de hora vÃ¡lido (HH:MM)`,
      severity: "warning",
      suggestion: "Usa formato 24h (ej: 09:00, 18:30, 22:00)",
    };
  }

  return { valid: true };
}

/**
 * Valida que un nombre tenga longitud aceptable
 */
function validateName(value: unknown): ValidationFieldResult {
  const str = String(value).trim();

  if (str.length < 3) {
    return {
      valid: true, // No bloquear, solo warning
      message: `El nombre "${str}" es demasiado corto (mÃ­nimo 3 caracteres recomendado)`,
      severity: "warning",
      suggestion: "Proporciona un nombre mÃ¡s descriptivo",
    };
  }

  if (str.length > 255) {
    return {
      valid: false,
      message: "El nombre es demasiado largo (mÃ¡ximo 255 caracteres)",
      severity: "error",
      suggestion: "Acorta el nombre del establecimiento",
    };
  }

  return { valid: true };
}

/**
 * Valida formato de email
 */
function validateEmail(value: unknown): ValidationFieldResult {
  const str = String(value).trim();
  if (!str) return { valid: true };

  // Regex bÃ¡sica para email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return {
      valid: false,
      message: `"${str}" no tiene un formato de email vÃ¡lido`,
      severity: "warning",
      suggestion: "Verifica el formato del email (ej: ejemplo@dominio.com)",
    };
  }

  return { valid: true };
}

/**
 * Valida formato de URL
 */
function validateUrl(value: unknown): ValidationFieldResult {
  const str = String(value).trim();
  if (!str) return { valid: true };

  const invalidUrlResult: ValidationFieldResult = {
    valid: false,
    message: `"${str}" no es una URL válida`,
    severity: "warning",
    suggestion: "Las URLs deben comenzar con http:// o https://",
  };

  const isSharePointHost = (hostname: string): boolean => {
    const normalizedHostname = hostname.toLowerCase();
    return (
      normalizedHostname === "sharepoint.com" || normalizedHostname.endsWith(".sharepoint.com")
    );
  };

  try {
    new URL(str);
    return { valid: true };
  } catch {
    // Si aparenta ser una URL absoluta pero no parsea, es inválida.
    if (/^https?:/i.test(str)) {
      return invalidUrlResult;
    }

    // Permitir rutas relativas típicas de SharePoint.
    if (/^\/sites\/[^/\s]+(?:\/.*)?$/i.test(str)) {
      return { valid: true };
    }

    // Aceptar formato parcial de dominio SharePoint (sin esquema) validando hostname parseado.
    const normalizedSharePointCandidate = `https://${str.replace(/^\/\//, "")}`;
    try {
      const parsedSharePointUrl = new URL(normalizedSharePointCandidate);
      if (isSharePointHost(parsedSharePointUrl.hostname)) {
        return { valid: true };
      }
    } catch {
      // Si no parsea, es inválida.
    }

    return invalidUrlResult;
  }
}

/**
 * Valida valores booleanos en espaÃ±ol/inglÃ©s
 */
function validateBoolean(value: unknown): ValidationFieldResult {
  const str = String(value).trim().toLowerCase();
  if (!str) return { valid: true };

  const validValues = ["si", "sÃ­", "no", "true", "false", "1", "0", "yes", "verdadero", "falso"];

  if (!validValues.includes(str)) {
    return {
      valid: true, // No bloquear, solo warning
      message: `"${value}" podrÃ­a no ser un valor booleano reconocido`,
      severity: "warning",
      suggestion: 'Usa "SÃ­"/"No", "true"/"false" o "1"/"0"',
    };
  }

  return { valid: true };
}

// ============================================================
// Transforms
// ============================================================

/**
 * Normaliza coordenadas: coma â†’ punto
 */
function transformCoordinate(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const str = String(value).trim();
  if (!str) return str;
  return str.replace(/,/g, ".");
}

/**
 * Trim de espacios
 */
function transformTrim(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  return value;
}

/**
 * Normaliza booleanos a "true"/"false"
 */
function transformBoolean(value: unknown): unknown {
  const str = String(value).trim().toLowerCase();
  if (["si", "sÃ­", "yes", "true", "1", "verdadero"].includes(str)) return "true";
  if (["no", "false", "0", "falso"].includes(str)) return "false";
  return str;
}

// ============================================================
// Mapeo de tipos FieldDefinition â†’ @batchactions/import type
// ============================================================

const TYPE_MAP: Record<string, "string" | "number" | "boolean" | "date" | "email" | "custom"> = {
  string: "string",
  number: "custom", // Usamos custom para coordenadas con validaciÃ³n especial
  boolean: "custom", // Usamos custom para booleanos con formatos espaÃ±ol
  url: "custom", // Usamos custom para URLs con validaciÃ³n flexible
  email: "email",
  date: "date",
};

// ============================================================
// GeneraciÃ³n del schema
// ============================================================

/**
 * Extrae aliases de las keywords de un FieldDefinition.
 * Excluye el key propio del campo para evitar duplicados.
 */
function extractAliases(field: FieldDefinition): string[] {
  if (!field.keywords) return [];
  return field.keywords.filter((kw) => kw.toLowerCase() !== field.key.toLowerCase());
}

/**
 * Obtiene el custom validator apropiado para un campo
 */
function getCustomValidator(
  field: FieldDefinition
): ((value: unknown) => ValidationFieldResult) | undefined {
  switch (field.key) {
    case "proposedName":
      return validateName;
    case "postalCode":
      return validatePostalCode;
    case "latitude":
      return validateLatitude;
    case "longitude":
      return validateLongitude;
    case "submitterEmail":
      return validateEmail;
    case "weekdayOpening":
    case "weekdayClosing":
    case "saturdayOpening":
    case "saturdayClosing":
    case "sundayOpening":
    case "sundayClosing":
      return validateTimeFormat;
    default:
      // Validators por tipo
      if (field.type === "url") return validateUrl;
      if (field.type === "boolean") return validateBoolean;
      return undefined;
  }
}

/**
 * Obtiene el transform apropiado para un campo
 */
function getTransform(field: FieldDefinition): ((value: unknown) => unknown) | undefined {
  switch (field.key) {
    case "latitude":
    case "longitude":
      return transformCoordinate;
    default:
      if (field.type === "boolean") return transformBoolean;
      return transformTrim;
  }
}

/**
 * Convierte un FieldDefinition a un campo de @batchactions/import
 */
function toSchemaField(field: FieldDefinition) {
  const bulkimportType = TYPE_MAP[field.type] || "string";
  const customValidator = getCustomValidator(field);
  const transform = getTransform(field);

  return {
    name: field.key,
    type: customValidator ? ("custom" as const) : bulkimportType,
    required: field.required,
    aliases: extractAliases(field),
    ...(customValidator && { customValidator }),
    ...(transform && { transform }),
  };
}

/**
 * Schema de importaciÃ³n de AEDs para @batchactions/import
 *
 * Combina todos los campos de REQUIRED_FIELDS y OPTIONAL_FIELDS
 * con validadores custom, transforms, y aliases extraÃ­dos de las keywords.
 *
 * @example
 * ```typescript
 * import { BulkImport, CsvParser, BufferSource } from '@batchactions/import';
 * import { aedImportSchema } from './aedImportSchema';
 *
 * const importer = new BulkImport({
 *   schema: aedImportSchema,
 *   batchSize: 50,
 *   continueOnError: true,
 * });
 * ```
 */
export const aedImportSchema: SchemaDefinition = {
  fields: [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(toSchemaField),
  strict: false, // Permitir columnas desconocidas (CSV puede tener columnas extra)
  skipEmptyRows: true,
  // Campos que deben ser únicos dentro del mismo CSV (intra-import dedup).
  // La dedup contra la base de datos la hace AedDuplicateChecker (external dedup).
  uniqueFields: ["code", "externalReference"],
};

/**
 * Schema estricto (rechaza columnas desconocidas)
 * Ãštil para validaciones mÃ¡s rigurosas
 */
export const aedImportSchemaStrict: SchemaDefinition = {
  ...aedImportSchema,
  strict: true,
};

/**
 * Obtiene solo los campos requeridos del schema
 * Ãštil para validaciones rÃ¡pidas de preview
 */
export function getRequiredFieldNames(): string[] {
  return REQUIRED_FIELDS.map((f) => f.key);
}

/**
 * Obtiene todos los nombres de campo del schema
 */
export function getAllFieldNames(): string[] {
  return [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((f) => f.key);
}

/**
 * Obtiene los aliases planos para un campo especÃ­fico
 */
export function getFieldAliases(fieldKey: string): string[] {
  const allFields = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
  const field = allFields.find((f) => f.key === fieldKey);
  if (!field) return [];
  return extractAliases(field);
}
