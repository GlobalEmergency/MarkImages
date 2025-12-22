/**
 * SharePoint Detection Service (Domain Service)
 *
 * Servicio de dominio para detectar URLs de SharePoint en datos de importación.
 * Analiza los campos de imagen y determina si se requiere autenticación especial.
 */

import { AedImportData } from "../value-objects/AedImportData";
import { ColumnMapping } from "../../application/services/ColumnMappingService";

export interface SharePointDetectionResult {
  detected: boolean;
  sampleUrls: string[];
  imageFields: string[];
}

export class SharePointDetectionService {
  private readonly SHAREPOINT_DOMAINS = [
    "sharepoint.com",
    "sharepoint-df.com",
    "microsoft.sharepoint.com",
  ];

  private readonly IMAGE_FIELDS = ["photo1Url", "photo2Url", "photo3Url"];

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
          if (this.isSharePointUrl(url)) {
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
   * Verifica si una URL pertenece a SharePoint
   */
  private isSharePointUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      return this.SHAREPOINT_DOMAINS.some((domain) => hostname.includes(domain));
    } catch {
      // URL inválida, no es SharePoint
      return false;
    }
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
