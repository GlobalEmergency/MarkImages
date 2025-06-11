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
  private mapToDeaRecord(record: Record<string, unknown>): DeaRecord {
    return {
      ...record,
      horaInicio: (record.horaInicio as Date).toISOString(),
      horaFinalizacion: (record.horaFinalizacion as Date).toISOString(),
      createdAt: (record.createdAt as Date).toISOString(),
      updatedAt: (record.updatedAt as Date).toISOString()
    } as DeaRecord;
  }

  async findAll(): Promise<DeaRecord[]> {
    const records = await prisma.deaRecord.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return records.map(record => this.mapToDeaRecord(record));
  }

  async findById(id: number): Promise<DeaRecord | null> {
    const record = await prisma.deaRecord.findUnique({
      where: { id }
    });
    return record ? this.mapToDeaRecord(record) : null;
  }

  async create(data: Omit<DeaRecord, 'id'>): Promise<DeaRecord> {
    const record = await prisma.deaRecord.create({ 
      data: {
        ...data,
        horaInicio: new Date(data.horaInicio),
        horaFinalizacion: new Date(data.horaFinalizacion),
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt)
      }
    });
    return this.mapToDeaRecord(record);
  }

  async update(id: number, data: Partial<DeaRecord>): Promise<DeaRecord> {
    const updateData: Record<string, unknown> = { ...data };
    if (data.horaInicio) updateData.horaInicio = new Date(data.horaInicio);
    if (data.horaFinalizacion) updateData.horaFinalizacion = new Date(data.horaFinalizacion);
    if (data.updatedAt) updateData.updatedAt = new Date(data.updatedAt);

    const record = await prisma.deaRecord.update({
      where: { id },
      data: updateData
    });
    return this.mapToDeaRecord(record);
  }

  async delete(id: number): Promise<DeaRecord> {
    const record = await prisma.deaRecord.delete({
      where: { id }
    });
    return this.mapToDeaRecord(record);
  }
}
