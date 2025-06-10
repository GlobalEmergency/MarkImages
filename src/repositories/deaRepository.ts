import { prisma } from '@/lib/db'
import type { DeaRecord } from '@/types'

export interface IDeaRepository {
  findAll(): Promise<DeaRecord[]>;
  findById(id: number): Promise<DeaRecord | null>;
  create(data: Omit<DeaRecord, 'id'>): Promise<DeaRecord>;
  update(id: number, data: Partial<DeaRecord>): Promise<DeaRecord>;
  delete(id: number): Promise<DeaRecord>;
}

export class DeaRepository implements IDeaRepository {
  async findAll(): Promise<DeaRecord[]> {
    return await prisma.deaRecord.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: number): Promise<DeaRecord | null> {
    return await prisma.deaRecord.findUnique({
      where: { id }
    });
  }

  async create(data: Omit<DeaRecord, 'id'>): Promise<DeaRecord> {
    return await prisma.deaRecord.create({ data });
  }

  async update(id: number, data: Partial<DeaRecord>): Promise<DeaRecord> {
    return await prisma.deaRecord.update({
      where: { id },
      data
    });
  }

  async delete(id: number): Promise<DeaRecord> {
    return await prisma.deaRecord.delete({
      where: { id }
    });
  }
}
