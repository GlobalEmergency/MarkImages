/**
 * Use Case: Get Batch Job Errors
 *
 * Obtiene la lista de errores de un batch job específico
 * con soporte para paginación.
 */

import type { PrismaClient } from "@/generated/client/client";
import type { ImportError } from "@/types/import";

interface GetBatchJobErrorsRequest {
  batchId: string;
  page?: number;
  limit?: number;
}

interface GetBatchJobErrorsResponse {
  errors: ImportError[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class GetBatchJobErrorsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(request: GetBatchJobErrorsRequest): Promise<GetBatchJobErrorsResponse> {
    const { batchId, page = 1, limit = 50 } = request;

    const skip = (page - 1) * limit;

    // Obtener errores y total
    const [errors, total] = await Promise.all([
      this.prisma.batchJobError.findMany({
        where: { job_id: batchId },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.batchJobError.count({
        where: { job_id: batchId },
      }),
    ]);

    // Transformar a formato ImportError
    const transformedErrors: ImportError[] = errors.map((error) => ({
      id: error.id,
      import_batch_id: error.job_id,
      row_number: error.record_index ?? null,
      record_reference: error.record_reference ?? null,
      error_type: this.mapErrorType(error.error_type),
      affected_field: null,
      original_value: null,
      error_message: error.error_message,
      severity: error.severity,
      row_data: error.row_data as Record<string, unknown> | null,
      created_at: error.created_at.toISOString(),
    }));

    return {
      errors: transformedErrors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private mapErrorType(type: string): ImportError["error_type"] {
    const mapping: Record<string, ImportError["error_type"]> = {
      VALIDATION: "VALIDATION",
      FORMAT: "FORMAT",
      DUPLICATE: "DUPLICATE_DATA",
      MISSING_DATA: "MISSING_DATA",
      INVALID_DATA: "INVALID_DATA",
      RELATION_NOT_FOUND: "RELATION_NOT_FOUND",
      INVALID_COORDINATES: "INVALID_COORDINATES",
      ADDRESS_NOT_FOUND: "ADDRESS_NOT_FOUND",
    };

    return mapping[type] ?? "SYSTEM_ERROR";
  }
}
