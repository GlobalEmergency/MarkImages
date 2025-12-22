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
}
