/**
 * Factory: Crea el adapter correcto según el tipo de fuente de datos
 * Capa de Infraestructura
 */

import type {
  IDataSourceAdapter,
  IDataSourceAdapterFactory,
  DataSourceType,
} from "@/import/domain/ports/IDataSourceAdapter";
import { CsvDataSourceAdapter } from "./CsvDataSourceAdapter";
import { CkanApiAdapter } from "./CkanApiAdapter";
import { JsonFileAdapter } from "./JsonFileAdapter";
import type { CsvParserAdapter } from "../parsers/CsvParserAdapter";

export class DataSourceAdapterFactory implements IDataSourceAdapterFactory {
  private readonly adapters: Map<DataSourceType, IDataSourceAdapter>;

  constructor(csvParser?: CsvParserAdapter) {
    this.adapters = new Map<DataSourceType, IDataSourceAdapter>([
      ["CKAN_API", new CkanApiAdapter()],
      ["JSON_FILE", new JsonFileAdapter()],
      // ["REST_API", new RestApiAdapter()],
    ]);

    // CSV adapter requiere un parser
    if (csvParser) {
      this.adapters.set("CSV_FILE", new CsvDataSourceAdapter(csvParser));
    }
  }

  create(type: DataSourceType): IDataSourceAdapter {
    const adapter = this.adapters.get(type);

    if (!adapter) {
      throw new Error(
        `Unsupported data source type: ${type}. Supported types: ${this.getSupportedTypes().join(", ")}`
      );
    }

    return adapter;
  }

  supports(type: DataSourceType): boolean {
    return this.adapters.has(type);
  }

  getSupportedTypes(): DataSourceType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Registra un nuevo adapter
   */
  registerAdapter(type: DataSourceType, adapter: IDataSourceAdapter): void {
    this.adapters.set(type, adapter);
  }

  /**
   * Método estático para obtener un adapter de API (sin necesidad de CSV parser)
   * Útil para endpoints que solo trabajan con APIs externas
   */
  static getApiAdapter(type: DataSourceType): IDataSourceAdapter {
    switch (type) {
      case "CKAN_API":
        return new CkanApiAdapter();
      case "JSON_FILE":
        return new JsonFileAdapter();
      case "CSV_FILE":
        throw new Error(
          `El tipo "${type}" requiere importación CSV, no sincronización API. ` +
            `Usa el módulo de importación CSV en su lugar.`
        );
      case "REST_API":
        throw new Error(
          `El tipo "${type}" aún no tiene adapter implementado. ` +
            `Tipos soportados para sync: CKAN_API, JSON_FILE.`
        );
      default:
        throw new Error(
          `Tipo de fuente de datos no soportado: ${type}. ` +
            `Tipos soportados: CKAN_API, JSON_FILE.`
        );
    }
  }

  /**
   * Método estático para crear la factory con todos los adapters disponibles
   */
  static createDefault(csvParser?: CsvParserAdapter): DataSourceAdapterFactory {
    return new DataSourceAdapterFactory(csvParser);
  }
}
