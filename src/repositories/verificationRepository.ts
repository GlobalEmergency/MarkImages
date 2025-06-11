import { prisma } from '@/lib/db';
import type { VerificationSession, VerificationStatus, VerificationStep, ImageType } from '@/types/verification';

export interface IVerificationRepository {
  findAll(): Promise<VerificationSession[]>;
  findById(id: number): Promise<VerificationSession | null>;
  findByDeaRecordId(deaRecordId: number): Promise<VerificationSession | null>;
  findByDeaRecordIdForValidation(deaRecordId: number): Promise<VerificationSession | null>;
  create(data: Omit<VerificationSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<VerificationSession>;
  update(id: number, data: Partial<VerificationSession>): Promise<VerificationSession>;
  updateStep(id: number, step: VerificationStep): Promise<VerificationSession>;
  updateStatus(id: number, status: VerificationStatus): Promise<VerificationSession>;
  updateStepData(id: number, stepData: Record<string, unknown>): Promise<VerificationSession>;
  createOrUpdateForValidation(deaRecordId: number, stepData: Record<string, unknown>, currentStep?: string): Promise<VerificationSession>;
  delete(id: number): Promise<VerificationSession>;
  findPendingVerifications(): Promise<VerificationSession[]>;
}

export class VerificationRepository implements IVerificationRepository {
  private mapToVerificationSession(session: Record<string, unknown>): VerificationSession {
    return {
      id: session.id as number,
      deaRecordId: session.deaRecordId as number,
      status: session.status as VerificationStatus,
      currentStep: session.currentStep as VerificationStep,
      stepData: session.stepData as Record<string, unknown> | undefined,
      originalImageUrl: (session.originalImageUrl as string) || undefined,
      croppedImageUrl: (session.croppedImageUrl as string) || undefined,
      processedImageUrl: (session.processedImageUrl as string) || undefined,
      secondImageUrl: (session.secondImageUrl as string) || undefined,
      secondCroppedImageUrl: (session.secondCroppedImageUrl as string) || undefined,
      secondProcessedImageUrl: (session.secondProcessedImageUrl as string) || undefined,
      createdAt: (session.createdAt as Date).toISOString(),
      updatedAt: (session.updatedAt as Date).toISOString(),
      completedAt: session.completedAt ? (session.completedAt as Date).toISOString() : undefined,
      deaRecord: session.deaRecord ? {
        id: (session.deaRecord as Record<string, unknown>).id as number,
        horaInicio: ((session.deaRecord as Record<string, unknown>).horaInicio as Date).toISOString(),
        horaFinalizacion: ((session.deaRecord as Record<string, unknown>).horaFinalizacion as Date).toISOString(),
        correoElectronico: (session.deaRecord as Record<string, unknown>).correoElectronico as string,
        nombre: (session.deaRecord as Record<string, unknown>).nombre as string,
        numeroProvisionalDea: (session.deaRecord as Record<string, unknown>).numeroProvisionalDea as number,
        tipoEstablecimiento: (session.deaRecord as Record<string, unknown>).tipoEstablecimiento as string,
        titularidadLocal: (session.deaRecord as Record<string, unknown>).titularidadLocal as string,
        usoLocal: (session.deaRecord as Record<string, unknown>).usoLocal as string,
        titularidad: (session.deaRecord as Record<string, unknown>).titularidad as string,
        propuestaDenominacion: (session.deaRecord as Record<string, unknown>).propuestaDenominacion as string,
        tipoVia: (session.deaRecord as Record<string, unknown>).tipoVia as string,
        nombreVia: (session.deaRecord as Record<string, unknown>).nombreVia as string,
        numeroVia: ((session.deaRecord as Record<string, unknown>).numeroVia as string) || undefined,
        complementoDireccion: ((session.deaRecord as Record<string, unknown>).complementoDireccion as string) || undefined,
        codigoPostal: (session.deaRecord as Record<string, unknown>).codigoPostal as number,
        distrito: (session.deaRecord as Record<string, unknown>).distrito as string,
        latitud: (session.deaRecord as Record<string, unknown>).latitud as number,
        longitud: (session.deaRecord as Record<string, unknown>).longitud as number,
        horarioApertura: (session.deaRecord as Record<string, unknown>).horarioApertura as string,
        aperturaLunesViernes: (session.deaRecord as Record<string, unknown>).aperturaLunesViernes as number,
        cierreLunesViernes: (session.deaRecord as Record<string, unknown>).cierreLunesViernes as number,
        aperturaSabados: (session.deaRecord as Record<string, unknown>).aperturaSabados as number,
        cierreSabados: (session.deaRecord as Record<string, unknown>).cierreSabados as number,
        aperturaDomingos: (session.deaRecord as Record<string, unknown>).aperturaDomingos as number,
        cierreDomingos: (session.deaRecord as Record<string, unknown>).cierreDomingos as number,
        vigilante24h: (session.deaRecord as Record<string, unknown>).vigilante24h as string,
        foto1: ((session.deaRecord as Record<string, unknown>).foto1 as string) || undefined,
        foto2: ((session.deaRecord as Record<string, unknown>).foto2 as string) || undefined,
        descripcionAcceso: ((session.deaRecord as Record<string, unknown>).descripcionAcceso as string) || undefined,
        comentarioLibre: ((session.deaRecord as Record<string, unknown>).comentarioLibre as string) || undefined,
        createdAt: ((session.deaRecord as Record<string, unknown>).createdAt as Date).toISOString(),
        updatedAt: ((session.deaRecord as Record<string, unknown>).updatedAt as Date).toISOString()
      } : undefined,
      arrowMarkers: (session.arrowMarkers as Record<string, unknown>[])?.map((marker) => ({
        id: marker.id as number,
        verificationSessionId: marker.verificationSessionId as number,
        imageNumber: marker.imageNumber as number,
        startX: marker.startX as number,
        startY: marker.startY as number,
        endX: marker.endX as number,
        endY: marker.endY as number,
        arrowColor: marker.arrowColor as string,
        arrowWidth: marker.arrowWidth as number,
        createdAt: (marker.createdAt as Date).toISOString()
      })),
      processedImages: (session.processedImages as Record<string, unknown>[])?.map((image) => ({
        id: image.id as number,
        verificationSessionId: image.verificationSessionId as number,
        originalFilename: image.originalFilename as string,
        processedFilename: image.processedFilename as string,
        imageType: image.imageType as ImageType,
        fileSize: image.fileSize as number,
        dimensions: image.dimensions as string,
        createdAt: (image.createdAt as Date).toISOString()
      }))
    };
  }

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

  async findByDeaRecordIdForValidation(deaRecordId: number): Promise<VerificationSession | null> {
    const session = await prisma.verificationSession.findFirst({
      where: { 
        deaRecordId,
        currentStep: 'data_validation'
      },
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    return session ? this.mapToVerificationSession(session) : null;
  }

  async create(data: Omit<VerificationSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<VerificationSession> {
    const session = await prisma.verificationSession.create({
      data: {
        deaRecordId: data.deaRecordId,
        status: data.status,
        currentStep: data.currentStep,
        stepData: data.stepData ? JSON.parse(JSON.stringify(data.stepData)) : null,
        originalImageUrl: data.originalImageUrl || null,
        croppedImageUrl: data.croppedImageUrl || null,
        processedImageUrl: data.processedImageUrl || null,
        secondImageUrl: data.secondImageUrl || null,
        secondCroppedImageUrl: data.secondCroppedImageUrl || null,
        secondProcessedImageUrl: data.secondProcessedImageUrl || null,
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
    if (data.stepData !== undefined) updateData.stepData = data.stepData ? JSON.parse(JSON.stringify(data.stepData)) : null;
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

  async updateStepData(id: number, stepData: Record<string, unknown>): Promise<VerificationSession> {
    const session = await prisma.verificationSession.update({
      where: { id },
      data: { stepData: JSON.parse(JSON.stringify(stepData)) },
      include: {
        deaRecord: true,
        arrowMarkers: true,
        processedImages: true
      }
    });

    return this.mapToVerificationSession(session);
  }

  async createOrUpdateForValidation(deaRecordId: number, stepData: Record<string, unknown>, currentStep?: string): Promise<VerificationSession> {
    // Buscar sesión existente para validación
    const existingSession = await prisma.verificationSession.findFirst({
      where: { 
        deaRecordId,
        currentStep: 'data_validation'
      }
    });

    if (existingSession) {
      // Actualizar sesión existente
      return this.updateStepData(existingSession.id, stepData);
    } else {
      // Crear nueva sesión
      const session = await prisma.verificationSession.create({
        data: {
          deaRecordId,
          status: 'in_progress',
          currentStep: currentStep || 'data_validation',
          stepData: JSON.parse(JSON.stringify(stepData))
        },
        include: {
          deaRecord: true,
          arrowMarkers: true,
          processedImages: true
        }
      });

      return this.mapToVerificationSession(session);
    }
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
}

// Exportar instancia singleton
export const verificationRepository = new VerificationRepository();
