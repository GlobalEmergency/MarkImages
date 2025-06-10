import { prisma } from '@/lib/db';
import type { ProcessedImage, ImageType } from '@/types/verification';

export interface IProcessedImageRepository {
  findBySessionId(sessionId: number): Promise<ProcessedImage[]>;
  create(data: Omit<ProcessedImage, 'id' | 'createdAt'>): Promise<ProcessedImage>;
  update(id: number, data: Partial<ProcessedImage>): Promise<ProcessedImage>;
  delete(id: number): Promise<ProcessedImage>;
  deleteBySessionId(sessionId: number): Promise<void>;
  findByType(sessionId: number, imageType: ImageType): Promise<ProcessedImage | null>;
}

export class ProcessedImageRepository implements IProcessedImageRepository {
  async findBySessionId(sessionId: number): Promise<ProcessedImage[]> {
    const images = await prisma.processedImage.findMany({
      where: { verificationSessionId: sessionId },
      orderBy: { createdAt: 'asc' }
    });

    return images.map(this.mapToProcessedImage);
  }

  async create(data: Omit<ProcessedImage, 'id' | 'createdAt'>): Promise<ProcessedImage> {
    const image = await prisma.processedImage.create({
      data: {
        verificationSessionId: data.verificationSessionId,
        originalFilename: data.originalFilename,
        processedFilename: data.processedFilename,
        imageType: data.imageType,
        fileSize: data.fileSize,
        dimensions: data.dimensions
      }
    });

    return this.mapToProcessedImage(image);
  }

  async update(id: number, data: Partial<ProcessedImage>): Promise<ProcessedImage> {
    const updateData: Record<string, unknown> = {};
    
    if (data.originalFilename !== undefined) updateData.originalFilename = data.originalFilename;
    if (data.processedFilename !== undefined) updateData.processedFilename = data.processedFilename;
    if (data.imageType !== undefined) updateData.imageType = data.imageType;
    if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
    if (data.dimensions !== undefined) updateData.dimensions = data.dimensions;

    const image = await prisma.processedImage.update({
      where: { id },
      data: updateData
    });

    return this.mapToProcessedImage(image);
  }

  async delete(id: number): Promise<ProcessedImage> {
    const image = await prisma.processedImage.delete({
      where: { id }
    });

    return this.mapToProcessedImage(image);
  }

  async deleteBySessionId(sessionId: number): Promise<void> {
    await prisma.processedImage.deleteMany({
      where: { verificationSessionId: sessionId }
    });
  }

  async findByType(sessionId: number, imageType: ImageType): Promise<ProcessedImage | null> {
    const image = await prisma.processedImage.findFirst({
      where: { 
        verificationSessionId: sessionId,
        imageType: imageType
      },
      orderBy: { createdAt: 'desc' }
    });

    return image ? this.mapToProcessedImage(image) : null;
  }

  private mapToProcessedImage(image: any): ProcessedImage {
    return {
      id: image.id,
      verificationSessionId: image.verificationSessionId,
      originalFilename: image.originalFilename,
      processedFilename: image.processedFilename,
      imageType: image.imageType as ImageType,
      fileSize: image.fileSize,
      dimensions: image.dimensions,
      createdAt: image.createdAt.toISOString()
    };
  }
}
