/**
 * Registro singleton de transformadores de campos
 * Capa de Infraestructura
 */

import type { IFieldTransformer } from "@/import/domain/ports/IFieldTransformer";

export class TransformerRegistry {
  private static instance: TransformerRegistry;
  private transformers = new Map<string, IFieldTransformer>();

  private constructor() {}

  static getInstance(): TransformerRegistry {
    if (!TransformerRegistry.instance) {
      TransformerRegistry.instance = new TransformerRegistry();
    }
    return TransformerRegistry.instance;
  }

  register(transformer: IFieldTransformer): void {
    this.transformers.set(transformer.name, transformer);
  }

  get(name: string): IFieldTransformer | undefined {
    return this.transformers.get(name);
  }

  has(name: string): boolean {
    return this.transformers.has(name);
  }

  getRegisteredNames(): string[] {
    return Array.from(this.transformers.keys());
  }

  /**
   * Reset para tests
   */
  static resetForTesting(): void {
    TransformerRegistry.instance = new TransformerRegistry();
  }
}
