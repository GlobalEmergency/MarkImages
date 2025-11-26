import { NextRequest, NextResponse } from 'next/server';
import { SimpleVerificationService } from '@/services/simpleVerificationService';

const verificationService = new SimpleVerificationService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reason, notes } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'El motivo de descarte es requerido' },
        { status: 400 }
      );
    }

    const session = await verificationService.discardVerification(
      id,
      reason,
      notes
    );

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error discarding verification:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al descartar verificación' },
      { status: 500 }
    );
  }
}
