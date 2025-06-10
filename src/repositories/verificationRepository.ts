import { prisma } from '@/lib/db';
import type { VerificationSession, VerificationStatus, VerificationStep } from '@/types/verification';

export interface IVerificationRepository {
  findAll(): Promise<VerificationSession[]>;
  findById(id: number): Promise<VerificationSession | null>;
  findByDeaRecordId(deaRecordId: number): Promise<VerificationSession | null>;
  create(data: Omit<VerificationSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<VerificationSession>;
  update(id: number, data: Partial<VerificationSession>): Promise<VerificationSession>;
  updateStep(id: number, step: VerificationStep): Promise<VerificationSession>;
  updateStatus(id: number, status: VerificationStatus): Promise<VerificationSession>;
  delete(id: number): Promise<VerificationSession>;
  findPendingVerifications(): Promise<VerificationSession[]>;
}

export class VerificationRepository implements IVerificationRepository {
  async findAll(): Promise<VerificationSession[]> {
    const sessions = await prisma.verificationSession.findMany({
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return sessions.map(this.mapToVerificationSession);
  }

  async findById(id: number): Promise<VerificationSession | null> {
    const session = await prisma.verificationSession.findUnique({
      where: { id },
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      }
    });

    return session ? this.mapToVerificationSession(session) : null;
  }

  async findByDeaRecordId(deaRecordId: number): Promise<VerificationSession | null> {
    const session = await prisma.verificationSession.findFirst({
      where: { 
        deaRecordId,
        status: 'in_progress'
      },
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      }
    });

    return session ? this.mapToVerificationSession(session) : null;
  }

  async create(data: Omit<VerificationSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<VerificationSession> {
    const session = await prisma.verificationSession.create({
      data: {
        deaRecordId: data.deaRecordId,
        status: data.status,
        currentStep: data.currentStep,
        originalImageUrl: data.originalImageUrl,
        croppedImageUrl: data.croppedImageUrl,
        processedImageUrl: data.processedImageUrl,
        secondImageUrl: data.secondImageUrl,
        secondCroppedImageUrl: data.secondCroppedImageUrl,
        secondProcessedImageUrl: data.secondProcessedImageUrl,
        completedAt: data.completedAt ? new Date(data.completedAt) : null
      },
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      }
    });

    return this.mapToVerificationSession(session);
  }

  async update(id: number, data: Partial<VerificationSession>): Promise<VerificationSession> {
    const updateData: Record<string, unknown> = {};
    
    if (data.status) updateData.status = data.status;
    if (data.currentStep) updateData.currentStep = data.currentStep;
    if (data.originalImageUrl !== undefined) updateData.originalImageUrl = data.originalImageUrl;
    if (data.croppedImageUrl !== undefined) updateData.croppedImageUrl = data.croppedImageUrl;
    if (data.processedImageUrl !== undefined) updateData.processedImageUrl = data.processedImageUrl;
    if (data.secondImageUrl !== undefined) updateData.secondImageUrl = data.secondImageUrl;
    if (data.secondCroppedImageUrl !== undefined) updateData.secondCroppedImageUrl = data.secondCroppedImageUrl;
    if (data.secondProcessedImageUrl !== undefined) updateData.secondProcessedImageUrl = data.secondProcessedImageUrl;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;

    const session = await prisma.verificationSession.update({
      where: { id },
      data: updateData,
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      }
    });

    return this.mapToVerificationSession(session);
  }

  async updateStep(id: number, step: VerificationStep): Promise<VerificationSession> {
    const session = await prisma.verificationSession.update({
      where: { id },
      data: { currentStep: step },
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      }
    });

    return this.mapToVerificationSession(session);
  }

  async updateStatus(id: number, status: VerificationStatus): Promise<VerificationSession> {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const session = await prisma.verificationSession.update({
      where: { id },
      data: updateData,
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      }
    });

    return this.mapToVerificationSession(session);
  }

  async delete(id: number): Promise<VerificationSession> {
    const session = await prisma.verificationSession.delete({
      where: { id },
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      }
    });

    return this.mapToVerificationSession(session);
  }

  async findPendingVerifications(): Promise<VerificationSession[]> {
    const sessions = await prisma.verificationSession.findMany({
      where: {
        status: 'in_progress'
      },
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return sessions.map(this.mapToVerificationSession);
  }

  private mapToVerificationSession(session: any): VerificationSession {
    return {
      id: session.id,
      deaRecordId: session.deaRecordId,
      status: session.status as VerificationStatus,
      currentStep: session.currentStep as VerificationStep,
      originalImageUrl: session.originalImageUrl,
      croppedImageUrl: session.croppedImageUrl,
      processedImageUrl: session.processedImageUrl,
      secondImageUrl: session.secondImageUrl,
      secondCroppedImageUrl: session.secondCroppedImageUrl,
      secondProcessedImageUrl: session.secondProcessedImageUrl,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      completedAt: session.completedAt?.toISOString(),
      deaRecord: session.deaRecord,
      arrowMarkers: session.arrowMarkers?.map((marker: any) => ({
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
      })),
      processedImages: session.processedImages?.map((image: any) => ({
        id: image.id,
        verificationSessionId: image.verificationSessionId,
        originalFilename: image.originalFilename,
        processedFilename: image.processedFilename,
        imageType: image.imageType,
        fileSize: image.fileSize,
        dimensions: image.dimensions,
        createdAt: image.createdAt.toISOString()
      }))
    };
  }
}

// Exportar instancia singleton
export const verificationRepository = new VerificationRepository();
