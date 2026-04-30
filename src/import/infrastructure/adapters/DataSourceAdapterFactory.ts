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
import { RestApiAdapter } from "./RestApiAdapter";
import type { CsvParserAdapter } from "../parsers/CsvParserAdapter";

export class DataSourceAdapterFactory implements IDataSourceAdapterFactory {
  private readonly adapters: Map<DataSourceType, IDataSourceAdapter>;

  constructor(csvParser?: CsvParserAdapter) {
    this.adapters = new Map<DataSourceType, IDataSourceAdapter>([
      ["CSV_FILE", new CsvDataSourceAdapter(csvParser)],
      ["CKAN_API", new CkanApiAdapter()],
      ["JSON_FILE", new JsonFileAdapter()],
      ["REST_API", new RestApiAdapter()],
    ]);
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
   * Método estático para obtener un adapter según tipo.
   * CSV_FILE ahora soporta tanto ficheros locales como URLs remotas.
   */
  static getApiAdapter(type: DataSourceType): IDataSourceAdapter {
    switch (type) {
      case "CSV_FILE":
        return new CsvDataSourceAdapter();
      case "CKAN_API":
        return new CkanApiAdapter();
      case "JSON_FILE":
        return new JsonFileAdapter();
      case "REST_API":
        return new RestApiAdapter();
      default:
        throw new Error(
          `Tipo de fuente de datos no soportado: ${type}. ` +
            `Tipos soportados: CSV_FILE, CKAN_API, JSON_FILE, REST_API.`
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
