// src/services/verificationService.ts

import { DeaRepository } from '@/repositories/deaRepository';
import { VerificationRepository } from '@/repositories/verificationRepository';
import { ArrowMarkerRepository } from '@/repositories/arrowMarkerRepository';
import { ImageProcessingService } from './imageProcessingService';
import { VerificationStep } from '@/types/verification';
import type { 
  VerificationSession, 
  VerificationStatus,
  ArrowMarker 
} from '@/types/verification';
import type { DeaRecord } from '@/types';
import type { CropData, ArrowData } from '@/types/shared';

export interface IVerificationService {
  getDeaRecordsForVerification(): Promise<DeaRecord[]>;
  startVerification(deaId: number): Promise<VerificationSession>;
  getVerificationSession(sessionId: number): Promise<VerificationSession | null>;
  updateStep(sessionId: number, step: VerificationStep): Promise<VerificationSession>;
  saveCroppedImage(sessionId: number, imageUrl: string, cropData: CropData): Promise<VerificationSession>;
  saveArrowMarker(sessionId: number, arrowData: ArrowData): Promise<ArrowMarker>;
  completeVerification(sessionId: number): Promise<VerificationSession>;
  cancelVerification(sessionId: number): Promise<void>;
}

export class VerificationService implements IVerificationService {
  private deaRepository: DeaRepository;
  private verificationRepository: VerificationRepository;
  private arrowMarkerRepository: ArrowMarkerRepository;

  constructor() {
    this.deaRepository = new DeaRepository();
    this.verificationRepository = new VerificationRepository();
    this.arrowMarkerRepository = new ArrowMarkerRepository();
  }

  async getDeaRecordsForVerification(): Promise<DeaRecord[]> {
    // Obtener DEAs que tienen foto1 pero no están verificados
    const allRecords = await this.deaRepository.findAll();
    return allRecords.filter(record => 
      record.foto1 && record.foto1.trim() !== ''
    );
  }

  async startVerification(deaId: number): Promise<VerificationSession> {
    const deaRecord = await this.deaRepository.findById(deaId);
    if (!deaRecord) {
      throw new Error('DEA no encontrado');
    }

    if (!deaRecord.foto1) {
      throw new Error('El DEA no tiene una imagen para verificar');
    }

    // Crear nueva sesión de verificación
    const sessionData: Omit<VerificationSession, 'id' | 'createdAt' | 'updatedAt'> = {
      deaRecordId: deaId,
      status: 'in_progress' as VerificationStatus,
      currentStep: VerificationStep.DATA_VALIDATION,
      originalImageUrl: deaRecord.foto1
    };

    // Por ahora simularemos la creación de la sesión
    // En una implementación real, usaríamos el VerificationRepository
    const session: VerificationSession = {
      id: Date.now(), // ID temporal
      ...sessionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deaRecord
    };

    return session;
  }

  async getVerificationSession(sessionId: number): Promise<VerificationSession | null> {
    // Por ahora retornamos null, en implementación real usaríamos el repository
    console.log(`Getting verification session: ${sessionId}`);
    return null;
  }

  async updateStep(sessionId: number, step: VerificationStep): Promise<VerificationSession> {
    // Simular actualización de paso
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    session.currentStep = step;
    session.updatedAt = new Date().toISOString();

    return session;
  }

  async saveCroppedImage(
    sessionId: number, 
    imageUrl: string, 
    cropData: CropData
  ): Promise<VerificationSession> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    try {
      // Procesar la imagen recortada
      const processedImage = await ImageProcessingService.cropImage(
        imageUrl,
        cropData,
        {
          aspectRatio: 1,
          outputSize: { width: 1000, height: 1000 }
        }
      );

      session.croppedImageUrl = processedImage.imageUrl;
      session.updatedAt = new Date().toISOString();

      return session;
    } catch (error) {
      throw new Error(`Error al procesar la imagen: ${error}`);
    }
  }

  async saveArrowMarker(sessionId: number, arrowData: ArrowData): Promise<ArrowMarker> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    if (!session.croppedImageUrl) {
      throw new Error('No hay imagen recortada para añadir la flecha');
    }

    try {
      // Crear el marcador de flecha
      const arrowMarker = await this.arrowMarkerRepository.create({
        verificationSessionId: sessionId,
        imageNumber: 1, // Primera imagen
        startX: arrowData.startX,
        startY: arrowData.startY,
        endX: arrowData.endX,
        endY: arrowData.endY,
        arrowColor: arrowData.color,
        arrowWidth: arrowData.width
      });

      // Procesar la imagen con la flecha
      const imageWithArrow = await ImageProcessingService.addArrow(
        session.croppedImageUrl,
        [arrowData],
        {
          startPosition: 'bottom',
          color: arrowData.color,
          width: arrowData.width,
          headLength: 100,
          headWidth: 100
        }
      );

      // Actualizar la sesión con la imagen procesada
      session.processedImageUrl = imageWithArrow.imageUrl;
      session.updatedAt = new Date().toISOString();

      return arrowMarker;
    } catch (error) {
      throw new Error(`Error al guardar la flecha: ${error}`);
    }
  }

  async completeVerification(sessionId: number): Promise<VerificationSession> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    if (!session.processedImageUrl) {
      throw new Error('La verificación no está completa');
    }

    try {
      // Actualizar el estado de la sesión
      session.status = 'completed' as VerificationStatus;
      session.currentStep = 'completed' as VerificationStep;
      session.completedAt = new Date().toISOString();
      session.updatedAt = new Date().toISOString();

      // Aquí podríamos actualizar el DEA record con la imagen procesada
      if (session.deaRecord) {
        await this.deaRepository.update(session.deaRecord.id, {
          foto1: session.processedImageUrl
        });
      }

      return session;
    } catch (error) {
      throw new Error(`Error al completar la verificación: ${error}`);
    }
  }

  async cancelVerification(sessionId: number): Promise<void> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    try {
      // Eliminar marcadores de flecha asociados
      await this.arrowMarkerRepository.deleteBySessionId(sessionId);

      // Actualizar estado de la sesión
      session.status = 'cancelled' as VerificationStatus;
      session.updatedAt = new Date().toISOString();

      // En implementación real, actualizaríamos en la base de datos
    } catch (error) {
      throw new Error(`Error al cancelar la verificación: ${error}`);
    }
  }

  // Métodos auxiliares

  async getVerificationProgress(sessionId: number): Promise<{
    currentStep: VerificationStep;
    completedSteps: VerificationStep[];
    totalSteps: number;
    percentage: number;
  }> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    const allSteps: VerificationStep[] = [
      VerificationStep.DATA_VALIDATION,
      VerificationStep.DEA_INFO,
      VerificationStep.IMAGE_CROP_1,
      VerificationStep.ARROW_PLACEMENT_1,
      VerificationStep.IMAGE_VALIDATION_2,
      VerificationStep.IMAGE_CROP_2,
      VerificationStep.ARROW_PLACEMENT_2,
      VerificationStep.REVIEW,
      VerificationStep.COMPLETED
    ];

    const currentStepIndex = allSteps.indexOf(session.currentStep);
    const completedSteps = allSteps.slice(0, currentStepIndex);

    return {
      currentStep: session.currentStep,
      completedSteps,
      totalSteps: allSteps.length,
      percentage: Math.round((currentStepIndex / (allSteps.length - 1)) * 100)
    };
  }

  async getArrowMarkers(sessionId: number): Promise<ArrowMarker[]> {
    return await this.arrowMarkerRepository.findBySessionId(sessionId);
  }

  async deleteArrowMarker(markerId: number): Promise<void> {
    await this.arrowMarkerRepository.delete(markerId);
  }
}
