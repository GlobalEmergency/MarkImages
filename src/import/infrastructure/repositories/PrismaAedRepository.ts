/**
 * Prisma AED Repository (Infrastructure)
 *
 * Implementación concreta de IAedRepository usando Prisma.
 * Sigue el principio DIP: implementa la interfaz del dominio.
 */

import { PrismaClient } from "@/generated/client/client";
import { IAedRepository, DuplicateCheckResult } from "../../domain/ports/IAedRepository";

export class PrismaAedRepository implements IAedRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async existsById(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.aed.count({
        where: { id },
      });
      return count > 0;
    } catch {
      return false;
    }
  }

  async findByCode(code: string): Promise<DuplicateCheckResult | null> {
    const aed = await this.prisma.aed.findFirst({
      where: {
        code: {
          equals: code,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        code: true,
        external_reference: true,
      },
    });

    if (!aed) {
      return null;
    }

    return {
      isDuplicate: true,
      matchedBy: "code",
      matchedAedId: aed.id,
      matchedCode: aed.code,
      matchedExternalReference: aed.external_reference,
    };
  }

  async findByExternalReference(externalRef: string): Promise<DuplicateCheckResult | null> {
    const aed = await this.prisma.aed.findFirst({
      where: {
        external_reference: {
          equals: externalRef,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        code: true,
        external_reference: true,
      },
    });

    if (!aed) {
      return null;
    }

    return {
      isDuplicate: true,
      matchedBy: "externalReference",
      matchedAedId: aed.id,
      matchedCode: aed.code,
      matchedExternalReference: aed.external_reference,
    };
  }

  async findById(id: string): Promise<DuplicateCheckResult | null> {
    try {
      const aed = await this.prisma.aed.findUnique({
        where: { id },
        select: {
          id: true,
          code: true,
          external_reference: true,
        },
      });

      if (!aed) {
        return null;
      }

      return {
        isDuplicate: true,
        matchedBy: "id",
        matchedAedId: aed.id,
        matchedCode: aed.code,
        matchedExternalReference: aed.external_reference,
      };
    } catch {
      // ID no válido (no es UUID)
      return null;
    }
  }

  // ============================================================
  // Batch methods — optimized for checkBatch() (single query per field)
  // ============================================================

  async findByIds(ids: string[]): Promise<Map<string, DuplicateCheckResult>> {
    const result = new Map<string, DuplicateCheckResult>();
    if (ids.length === 0) return result;

    try {
      const aeds = await this.prisma.aed.findMany({
        where: { id: { in: ids } },
        select: { id: true, code: true, external_reference: true },
      });

      for (const aed of aeds) {
        result.set(aed.id, {
          isDuplicate: true,
          matchedBy: "id",
          matchedAedId: aed.id,
          matchedCode: aed.code,
          matchedExternalReference: aed.external_reference,
        });
      }
    } catch {
      // Si algún ID no es UUID válido, Prisma puede fallar;
      // fallback silencioso (los IDs inválidos simplemente no matchean)
    }

    return result;
  }

  async findByCodes(codes: string[]): Promise<Map<string, DuplicateCheckResult>> {
    const result = new Map<string, DuplicateCheckResult>();
    if (codes.length === 0) return result;

    const aeds = await this.prisma.aed.findMany({
      where: {
        code: { in: codes, mode: "insensitive" },
      },
      select: { id: true, code: true, external_reference: true },
    });

    for (const aed of aeds) {
      if (aed.code) {
        result.set(aed.code.toLowerCase(), {
          isDuplicate: true,
          matchedBy: "code",
          matchedAedId: aed.id,
          matchedCode: aed.code,
          matchedExternalReference: aed.external_reference,
        });
      }
    }

    return result;
  }

  async findByExternalReferences(refs: string[]): Promise<Map<string, DuplicateCheckResult>> {
    const result = new Map<string, DuplicateCheckResult>();
    if (refs.length === 0) return result;

    const aeds = await this.prisma.aed.findMany({
      where: {
        external_reference: { in: refs, mode: "insensitive" },
      },
      select: { id: true, code: true, external_reference: true },
    });

    for (const aed of aeds) {
      if (aed.external_reference) {
        result.set(aed.external_reference.toLowerCase(), {
          isDuplicate: true,
          matchedBy: "externalReference",
          matchedAedId: aed.id,
          matchedCode: aed.code,
          matchedExternalReference: aed.external_reference,
        });
      }
    }

    return result;
  }
}
