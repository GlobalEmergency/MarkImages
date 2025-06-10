// src/services/simpleVerificationService.ts

import { DeaRepository } from '@/repositories/deaRepository';
import { VerificationRepository } from '@/repositories/verificationRepository';
import { ArrowMarkerRepository } from '@/repositories/arrowMarkerRepository';
import { ProcessedImageRepository } from '@/repositories/processedImageRepository';
import { ServerImageProcessingService } from './serverImageProcessingService';
import { VerificationStep, VerificationStatus, ImageType } from '@/types/verification';
import { ARROW_CONFIG } from '@/utils/arrowConstants';
import type { 
  VerificationSession, 
  ArrowMarker 
} from '@/types/verification';
import type { DeaRecord } from '@/types';
import type { CropData, ArrowData } from '@/types/shared';

export class SimpleVerificationService {
  private deaRepository: DeaRepository;
  private verificationRepository: VerificationRepository;
  private arrowMarkerRepository: ArrowMarkerRepository;
  private processedImageRepository: ProcessedImageRepository;

  constructor() {
    this.deaRepository = new DeaRepository();
    this.verificationRepository = new VerificationRepository();
    this.arrowMarkerRepository = new ArrowMarkerRepository();
    this.processedImageRepository = new ProcessedImageRepository();
  }

  async getDeaRecordsForVerification(): Promise<DeaRecord[]> {
    // Obtener DEAs que tienen foto1 pero no han sido verificados
    const allRecords = await this.deaRepository.findAll();
    
    // Obtener IDs de DEAs que ya tienen sesiones completadas
    const completedSessions = await this.verificationRepository.findAll();
    const completedDeaIds = new Set(
      completedSessions
        .filter(session => session.status === VerificationStatus.COMPLETED)
        .map(session => session.deaRecordId)
    );
    
    return allRecords.filter(record => 
      record.foto1 && 
      record.foto1.trim() !== '' && 
      !completedDeaIds.has(record.id)
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

    // Verificar si ya existe una sesión en progreso
    const existingSession = await this.verificationRepository.findByDeaRecordId(deaId);
    if (existingSession) {
      return existingSession;
    }

    // Crear nueva sesión de verificación
    const session = await this.verificationRepository.create({
      deaRecordId: deaId,
      status: VerificationStatus.IN_PROGRESS,
      currentStep: VerificationStep.DATA_VALIDATION,
      originalImageUrl: deaRecord.foto1,
      secondImageUrl: deaRecord.foto2 // Cargar la segunda imagen si existe
    });

    return session;
  }

  async getVerificationSession(sessionId: number): Promise<VerificationSession | null> {
    return await this.verificationRepository.findById(sessionId);
  }

  async updateStep(sessionId: number, step: VerificationStep): Promise<VerificationSession> {
    return await this.verificationRepository.updateStep(sessionId, step);
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
      const processedImage = await ServerImageProcessingService.cropImage(
        imageUrl,
        cropData,
        {
          aspectRatio: 1,
          outputSize: { width: 1000, height: 1000 }
        }
      );

      // Actualizar sesión con imagen recortada
      const updatedSession = await this.verificationRepository.update(sessionId, {
        croppedImageUrl: processedImage.imageUrl
      });

      // Guardar información de la imagen procesada
      await this.processedImageRepository.create({
        verificationSessionId: sessionId,
        originalFilename: 'original_image.jpg',
        processedFilename: processedImage.filename,
        imageType: ImageType.CROPPED,
        fileSize: processedImage.fileSize,
        dimensions: processedImage.dimensions
      });

      return updatedSession;
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
      // Crear marcador de flecha en la base de datos
      const arrowMarker = await this.arrowMarkerRepository.create({
        verificationSessionId: sessionId,
        imageNumber: 1,
        startX: arrowData.startX,
        startY: arrowData.startY,
        endX: arrowData.endX,
        endY: arrowData.endY,
        arrowColor: arrowData.color,
        arrowWidth: arrowData.width
      });

      // Procesar la imagen con la flecha usando las constantes estandarizadas
      const imageWithArrow = await ServerImageProcessingService.addArrow(
        session.croppedImageUrl,
        [arrowData],
        {
          startPosition: 'bottom',
          color: ARROW_CONFIG.COLOR,
          width: ARROW_CONFIG.BODY_WIDTH,
          headLength: ARROW_CONFIG.HEAD_LENGTH,
          headWidth: ARROW_CONFIG.BODY_WIDTH
        }
      );

      // Actualizar sesión con imagen procesada
      await this.verificationRepository.update(sessionId, {
        processedImageUrl: imageWithArrow.imageUrl
      });

      // Guardar información de la imagen con flecha
      await this.processedImageRepository.create({
        verificationSessionId: sessionId,
        originalFilename: 'cropped_image.jpg',
        processedFilename: imageWithArrow.filename,
        imageType: ImageType.WITH_ARROW,
        fileSize: imageWithArrow.fileSize,
        dimensions: imageWithArrow.dimensions
      });

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
      // Actualizar sesión como completada
      const updatedSession = await this.verificationRepository.update(sessionId, {
        status: VerificationStatus.COMPLETED,
        currentStep: VerificationStep.COMPLETED,
        completedAt: new Date().toISOString()
      });

      // ✅ CAMBIO IMPORTANTE: NO actualizar la imagen original
      // La imagen original se mantiene intacta en dea_records.foto1
      // Solo guardamos la información de verificación en las tablas correspondientes

      return updatedSession;
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
      // Actualizar estado de la sesión
      await this.verificationRepository.update(sessionId, {
        status: VerificationStatus.CANCELLED
      });

      // Las flechas y imágenes procesadas se mantienen para auditoría
    } catch (error) {
      throw new Error(`Error al cancelar la verificación: ${error}`);
    }
  }

  async getArrowMarkers(sessionId: number): Promise<ArrowMarker[]> {
    return await this.arrowMarkerRepository.findBySessionId(sessionId);
  }

  async deleteArrowMarker(markerId: number): Promise<void> {
    await this.arrowMarkerRepository.delete(markerId);
  }
}
