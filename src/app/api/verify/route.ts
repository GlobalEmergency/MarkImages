import { NextRequest, NextResponse } from 'next/server';
import { SimpleVerificationService } from '@/services/simpleVerificationService';

const verificationService = new SimpleVerificationService();

export async function GET() {
  try {
    const deaRecords = await verificationService.getDeaRecordsForVerification();
    return NextResponse.json(deaRecords);
  } catch (error) {
    console.error('Error fetching DEA records for verification:', error);
    return NextResponse.json(
      { error: 'Error al obtener registros para verificación' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { deaId } = await request.json();
    
    if (!deaId) {
      return NextResponse.json(
        { error: 'ID del DEA es requerido' }, 
        { status: 400 }
      );
    }

    const session = await verificationService.startVerification(deaId);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error starting verification:', error);
    return NextResponse.json(
      { error: 'Error al iniciar verificación' }, 
      { status: 500 }
    );
  }
}
