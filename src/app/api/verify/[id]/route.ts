import { NextRequest, NextResponse } from 'next/server';
import { SimpleVerificationService } from '@/services/simpleVerificationService';
import { VerificationStep } from '@/types/verification';

const verificationService = new SimpleVerificationService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);
    
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'ID de sesión inválido' }, 
        { status: 400 }
      );
    }

    const session = await verificationService.getVerificationSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Sesión de verificación no encontrada' }, 
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error fetching verification session:', error);
    return NextResponse.json(
      { error: 'Error al obtener sesión de verificación' }, 
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);
    const { step } = await request.json();
    
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'ID de sesión inválido' }, 
        { status: 400 }
      );
    }

    if (!step || !Object.values(VerificationStep).includes(step)) {
      return NextResponse.json(
        { error: 'Paso de verificación inválido' }, 
        { status: 400 }
      );
    }

    const updatedSession = await verificationService.updateStep(sessionId, step);
    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error updating verification step:', error);
    return NextResponse.json(
      { error: 'Error al actualizar paso de verificación' }, 
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);
    
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'ID de sesión inválido' }, 
        { status: 400 }
      );
    }

    await verificationService.cancelVerification(sessionId);
    return NextResponse.json({ message: 'Verificación cancelada' });
  } catch (error) {
    console.error('Error canceling verification:', error);
    return NextResponse.json(
      { error: 'Error al cancelar verificación' }, 
      { status: 500 }
    );
  }
}
