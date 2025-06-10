import { NextRequest, NextResponse } from 'next/server';
import { SimpleVerificationService } from '@/services/simpleVerificationService';

const verificationService = new SimpleVerificationService();

export async function POST(
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

    const completedSession = await verificationService.completeVerification(sessionId);
    return NextResponse.json(completedSession);
  } catch (error) {
    console.error('Error completing verification:', error);
    return NextResponse.json(
      { error: 'Error al completar verificación' }, 
      { status: 500 }
    );
  }
}
