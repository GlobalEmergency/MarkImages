import { prisma } from '@/lib/db';
import type { ArrowMarker } from '@/types/verification';

export interface IArrowMarkerRepository {
  findBySessionId(sessionId: number): Promise<ArrowMarker[]>;
  create(data: Omit<ArrowMarker, 'id' | 'createdAt'>): Promise<ArrowMarker>;
  update(id: number, data: Partial<ArrowMarker>): Promise<ArrowMarker>;
  delete(id: number): Promise<ArrowMarker>;
  deleteBySessionId(sessionId: number): Promise<void>;
}

export class ArrowMarkerRepository implements IArrowMarkerRepository {
  async findBySessionId(sessionId: number): Promise<ArrowMarker[]> {
    const markers = await prisma.arrowMarker.findMany({
      where: { verificationSessionId: sessionId },
      orderBy: { createdAt: 'asc' }
    });

    return markers.map(this.mapToArrowMarker);
  }

  async create(data: Omit<ArrowMarker, 'id' | 'createdAt'>): Promise<ArrowMarker> {
    const marker = await prisma.arrowMarker.create({
      data: {
        verificationSessionId: data.verificationSessionId,
        imageNumber: data.imageNumber,
        startX: data.startX,
        startY: data.startY,
        endX: data.endX,
        endY: data.endY,
        arrowColor: data.arrowColor,
        arrowWidth: data.arrowWidth
      }
    });

    return this.mapToArrowMarker(marker);
  }

  async update(id: number, data: Partial<ArrowMarker>): Promise<ArrowMarker> {
    const updateData: Record<string, unknown> = {};
    
    if (data.imageNumber !== undefined) updateData.imageNumber = data.imageNumber;
    if (data.startX !== undefined) updateData.startX = data.startX;
    if (data.startY !== undefined) updateData.startY = data.startY;
    if (data.endX !== undefined) updateData.endX = data.endX;
    if (data.endY !== undefined) updateData.endY = data.endY;
    if (data.arrowColor !== undefined) updateData.arrowColor = data.arrowColor;
    if (data.arrowWidth !== undefined) updateData.arrowWidth = data.arrowWidth;

    const marker = await prisma.arrowMarker.update({
      where: { id },
      data: updateData
    });

    return this.mapToArrowMarker(marker);
  }

  async delete(id: number): Promise<ArrowMarker> {
    const marker = await prisma.arrowMarker.delete({
      where: { id }
    });

    return this.mapToArrowMarker(marker);
  }

  async deleteBySessionId(sessionId: number): Promise<void> {
    await prisma.arrowMarker.deleteMany({
      where: { verificationSessionId: sessionId }
    });
  }

  private mapToArrowMarker(marker: any): ArrowMarker {
    return {
      id: marker.id,
      verificationSessionId: marker.verificationSessionId,
      imageNumber: marker.imageNumber,
      startX: marker.startX,
      startY: marker.startY,
      endX: marker.endX,
      endY: marker.endY,
      arrowColor: marker.arrowColor,
      arrowWidth: marker.arrowWidth,
      createdAt: marker.createdAt.toISOString()
    };
  }
}

// Exportar instancia singleton
export const arrowMarkerRepository = new ArrowMarkerRepository();
