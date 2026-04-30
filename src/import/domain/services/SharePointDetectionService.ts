/**
 * SharePoint Detection Service (Domain Service)
 *
 * Servicio de dominio para detectar URLs de SharePoint en datos de importación.
 * Analiza los campos de imagen y determina si se requiere autenticación especial.
 */

import { AedImportData } from "../value-objects/AedImportData";
import { ColumnMapping } from "../../application/services/ColumnMappingService";
import { isSharePointUrl } from "@/shared/utils/sharepoint";

export interface SharePointDetectionResult {
  detected: boolean;
  sampleUrls: string[];
  imageFields: string[];
}

export class SharePointDetectionService {
  private readonly IMAGE_FIELDS = [
    "photo1Url",
    "photo2Url",
    "photo3Url",
    "photoFrontUrl",
    "photoLocationUrl",
    "photoAccessUrl",
  ];

  /**
   * Detecta si hay URLs de SharePoint en los registros de importación
   */
  detectSharePointUrls(
    records: AedImportData[],
    mappings: ColumnMapping[]
  ): SharePointDetectionResult {
    // Identificar qué campos de imagen están mapeados
    const mappedImageFields = this.getMappedImageFields(mappings);

    if (mappedImageFields.length === 0) {
      // No hay campos de imagen mapeados
      return {
        detected: false,
        sampleUrls: [],
        imageFields: [],
      };
    }

    const sharepointUrls: string[] = [];
    const fieldsWithSharePoint = new Set<string>();

    // Analizar cada registro
    for (const record of records) {
      const plainData = record.toPlainObject();

      // Revisar cada campo de imagen mapeado
      for (const field of mappedImageFields) {
        const value = plainData[field as keyof typeof plainData];

        if (typeof value === "string" && value.trim()) {
          const url = value.trim();

          // Verificar si es URL de SharePoint
          if (isSharePointUrl(url)) {
            // Agregar a las URLs de muestra (máximo 3)
            if (sharepointUrls.length < 3 && !sharepointUrls.includes(url)) {
              sharepointUrls.push(url);
            }

            // Registrar el campo que contiene SharePoint
            fieldsWithSharePoint.add(field);
          }
        }
      }

      // Si ya tenemos suficientes muestras, podemos parar
      if (sharepointUrls.length >= 3 && fieldsWithSharePoint.size === mappedImageFields.length) {
        break;
      }
    }

    return {
      detected: sharepointUrls.length > 0,
      sampleUrls: sharepointUrls,
      imageFields: Array.from(fieldsWithSharePoint),
    };
  }

  /**
   * Identifica qué campos de imagen están mapeados
   */
  private getMappedImageFields(mappings: ColumnMapping[]): string[] {
    return mappings
      .filter((mapping) => this.IMAGE_FIELDS.includes(mapping.systemField))
      .map((mapping) => mapping.systemField);
  }
}
