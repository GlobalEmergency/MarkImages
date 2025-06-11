import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DeaCodeGeneration {
  codigo: string;
  distrito: number;
  codigoPostal: string;
  secuencial: number;
  isValid: boolean;
  errors: string[];
}

export interface DeaCodeValidation {
  isValid: boolean;
  exists: boolean;
  format: {
    isCorrectFormat: boolean;
    expectedFormat: string;
    actualFormat: string;
  };
  components: {
    prefix: string;
    distrito: number;
    codigoPostal: string;
    secuencial: number;
  } | null;
  errors: string[];
}

export class DeaCodeService {
  
  /**
   * Genera un código DEA único
   * Formato: RM + distrito(2 dígitos) + CP(2 últimos dígitos) + D + secuencial(4 dígitos)
   * Ejemplo: RM1044D0456
   */
  async generateDeaCode(distrito: number, codigoPostal: string): Promise<DeaCodeGeneration> {
    const result: DeaCodeGeneration = {
      codigo: '',
      distrito,
      codigoPostal,
      secuencial: 0,
      isValid: false,
      errors: []
    };
    
    try {
      // Validar entrada
      if (!distrito || distrito < 1 || distrito > 21) {
        result.errors.push('Distrito inválido (debe estar entre 1 y 21)');
        return result;
      }
      
      if (!codigoPostal || codigoPostal.length !== 5) {
        result.errors.push('Código postal inválido (debe tener 5 dígitos)');
        return result;
      }
      
      // Obtener siguiente secuencial para el distrito
      const nextSequential = await this.getNextSequential(distrito);
      result.secuencial = nextSequential;
      
      // Construir el código
      const distritoFormatted = distrito.toString().padStart(2, '0');
      const cpLastTwo = codigoPostal.slice(-2);
      const secuencialFormatted = nextSequential.toString().padStart(4, '0');
      
      const codigo = `RM${distritoFormatted}${cpLastTwo}D${secuencialFormatted}`;
      result.codigo = codigo;
      
      // Verificar que no existe (doble verificación)
      const exists = await this.codeExists(codigo);
      if (exists) {
        result.errors.push('El código generado ya existe (error interno)');
        return result;
      }
      
      // Guardar el código en la base de datos
      await prisma.deaCode.create({
        data: {
          distrito,
          codigoPostal,
          secuencial: nextSequential,
          codigoCompleto: codigo
        }
      });
      
      result.isValid = true;
      
    } catch (error) {
      result.errors.push(`Error al generar código: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
    
    return result;
  }
  
  /**
   * Asigna un código DEA a un registro específico
   */
  async assignCodeToRecord(codigo: string, deaRecordId: number): Promise<boolean> {
    try {
      await prisma.deaCode.updateMany({
        where: { codigoCompleto: codigo },
        data: { deaRecordId }
      });
      return true;
    } catch (error) {
      console.error('Error asignando código a registro:', error);
      return false;
    }
  }
  
  /**
   * Valida un código DEA existente
   */
  async validateDeaCode(codigo: string): Promise<DeaCodeValidation> {
    const result: DeaCodeValidation = {
      isValid: false,
      exists: false,
      format: {
        isCorrectFormat: false,
        expectedFormat: 'RMDDCCD####',
        actualFormat: codigo
      },
      components: null,
      errors: []
    };
    
    try {
      // Validar formato
      const formatValidation = this.validateCodeFormat(codigo);
      result.format.isCorrectFormat = formatValidation.isValid;
      result.components = formatValidation.components;
      
      if (!formatValidation.isValid) {
        result.errors.push(...formatValidation.errors);
        return result;
      }
      
      // Verificar si existe en la base de datos
      result.exists = await this.codeExists(codigo);
      
      if (result.format.isCorrectFormat && result.exists) {
        result.isValid = true;
      }
      
    } catch (error) {
      result.errors.push(`Error validando código: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
    
    return result;
  }
  
  /**
   * Obtiene el siguiente número secuencial para un distrito
   */
  private async getNextSequential(distrito: number): Promise<number> {
    const lastCode = await prisma.deaCode.findFirst({
      where: { distrito },
      orderBy: { secuencial: 'desc' }
    });
    
    return lastCode ? lastCode.secuencial + 1 : 1;
  }
  
  /**
   * Verifica si un código ya existe
   */
  private async codeExists(codigo: string): Promise<boolean> {
    const existing = await prisma.deaCode.findUnique({
      where: { codigoCompleto: codigo }
    });
    
    return !!existing;
  }
  
  /**
   * Valida el formato de un código DEA
   */
  private validateCodeFormat(codigo: string): {
    isValid: boolean;
    components: {
      prefix: string;
      distrito: number;
      codigoPostal: string;
      secuencial: number;
    } | null;
    errors: string[];
  } {
    const result = {
      isValid: false,
      components: null as {
        prefix: string;
        distrito: number;
        codigoPostal: string;
        secuencial: number;
      } | null,
      errors: [] as string[]
    };
    
    if (!codigo || typeof codigo !== 'string') {
      result.errors.push('Código vacío o inválido');
      return result;
    }
    
    // Formato esperado: RM + DD + CC + D + #### (ej: RM1044D0456)
    const regex = /^RM(\d{2})(\d{2})D(\d{4})$/;
    const match = codigo.match(regex);
    
    if (!match) {
      result.errors.push('Formato incorrecto. Esperado: RMDDCCD#### (ej: RM1044D0456)');
      return result;
    }
    
    const distrito = parseInt(match[1]);
    const cpLastTwo = match[2];
    const secuencial = parseInt(match[3]);
    
    // Validar distrito
    if (distrito < 1 || distrito > 21) {
      result.errors.push('Distrito inválido en el código (debe estar entre 01 y 21)');
    }
    
    // Validar secuencial
    if (secuencial < 1 || secuencial > 9999) {
      result.errors.push('Secuencial inválido en el código (debe estar entre 0001 y 9999)');
    }
    
    if (result.errors.length === 0) {
      result.isValid = true;
      result.components = {
        prefix: 'RM',
        distrito,
        codigoPostal: cpLastTwo,
        secuencial
      };
    }
    
    return result;
  }
  
  /**
   * Obtiene estadísticas de códigos por distrito
   */
  async getCodeStatsByDistrict(): Promise<Array<{
    distrito: number;
    totalCodes: number;
    assignedCodes: number;
    availableCodes: number;
    lastSequential: number;
  }>> {
    const stats = await prisma.deaCode.groupBy({
      by: ['distrito'],
      _count: {
        id: true
      },
      _max: {
        secuencial: true
      }
    });
    
    const result = [];
    
    for (const stat of stats) {
      const assignedCount = await prisma.deaCode.count({
        where: {
          distrito: stat.distrito,
          deaRecordId: { not: null }
        }
      });
      
      result.push({
        distrito: stat.distrito,
        totalCodes: stat._count.id,
        assignedCodes: assignedCount,
        availableCodes: stat._count.id - assignedCount,
        lastSequential: stat._max.secuencial || 0
      });
    }
    
    return result.sort((a, b) => a.distrito - b.distrito);
  }
  
  /**
   * Busca códigos por criterios
   */
  async searchCodes(criteria: {
    distrito?: number;
    codigoPostal?: string;
    assigned?: boolean;
    limit?: number;
  }): Promise<Array<{
    id: number;
    codigo: string;
    distrito: number;
    codigoPostal: string;
    secuencial: number;
    deaRecordId: number | null;
    createdAt: Date;
  }>> {
    const where: Record<string, unknown> = {};
    
    if (criteria.distrito) {
      where.distrito = criteria.distrito;
    }
    
    if (criteria.codigoPostal) {
      where.codigoPostal = criteria.codigoPostal;
    }
    
    if (criteria.assigned !== undefined) {
      where.deaRecordId = criteria.assigned ? { not: null } : null;
    }
    
    const codes = await prisma.deaCode.findMany({
      where,
      take: criteria.limit || 50,
      orderBy: [
        { distrito: 'asc' },
        { secuencial: 'asc' }
      ]
    });
    
    return codes.map((code: {
      id: number;
      codigoCompleto: string;
      distrito: number;
      codigoPostal: string;
      secuencial: number;
      deaRecordId: number | null;
      createdAt: Date;
    }) => ({
      id: code.id,
      codigo: code.codigoCompleto,
      distrito: code.distrito,
      codigoPostal: code.codigoPostal,
      secuencial: code.secuencial,
      deaRecordId: code.deaRecordId,
      createdAt: code.createdAt
    }));
  }
  
  /**
   * Libera un código DEA (desasigna de un registro)
   */
  async releaseCode(codigo: string): Promise<boolean> {
    try {
      await prisma.deaCode.updateMany({
        where: { codigoCompleto: codigo },
        data: { deaRecordId: null }
      });
      return true;
    } catch (error) {
      console.error('Error liberando código:', error);
      return false;
    }
  }
  
  /**
   * Elimina un código DEA (solo si no está asignado)
   */
  async deleteCode(codigo: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await prisma.deaCode.findUnique({
        where: { codigoCompleto: codigo }
      });
      
      if (!existing) {
        return { success: false, error: 'Código no encontrado' };
      }
      
      if (existing.deaRecordId) {
        return { success: false, error: 'No se puede eliminar un código asignado' };
      }
      
      await prisma.deaCode.delete({
        where: { codigoCompleto: codigo }
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Error eliminando código: ${error instanceof Error ? error.message : 'Error desconocido'}` 
      };
    }
  }
  
  /**
   * Genera códigos en lote para un distrito
   */
  async generateBatchCodes(distrito: number, codigoPostal: string, quantity: number): Promise<{
    success: boolean;
    generatedCodes: string[];
    errors: string[];
  }> {
    const result = {
      success: false,
      generatedCodes: [] as string[],
      errors: [] as string[]
    };
    
    if (quantity > 100) {
      result.errors.push('No se pueden generar más de 100 códigos a la vez');
      return result;
    }
    
    try {
      for (let i = 0; i < quantity; i++) {
        const codeResult = await this.generateDeaCode(distrito, codigoPostal);
        
        if (codeResult.isValid) {
          result.generatedCodes.push(codeResult.codigo);
        } else {
          result.errors.push(...codeResult.errors);
          break; // Parar si hay error
        }
      }
      
      result.success = result.generatedCodes.length === quantity;
      
    } catch (error) {
      result.errors.push(`Error en generación en lote: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
    
    return result;
  }
}

export const deaCodeService = new DeaCodeService();
