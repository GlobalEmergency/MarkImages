import { NextRequest, NextResponse } from 'next/server';
import { madridGeocodingService } from '@/services/madridGeocodingService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const streetName = searchParams.get('streetName');
    const streetNumber = searchParams.get('streetNumber');
    const district = searchParams.get('district');
    const postalCode = searchParams.get('postalCode');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!streetName) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro streetName' },
        { status: 400 }
      );
    }
    
    if (limit > 50) {
      return NextResponse.json(
        { error: 'El límite máximo es 50 resultados' },
        { status: 400 }
      );
    }
    
    const results = await madridGeocodingService.searchAddresses(
      streetName,
      streetNumber || undefined,
      district ? parseInt(district) : undefined,
      postalCode || undefined,
      limit
    );
    
    return NextResponse.json({
      success: true,
      data: {
        results,
        count: results.length,
        query: {
          streetName,
          streetNumber,
          district,
          postalCode,
          limit
        }
      }
    });
    
  } catch (error) {
    console.error('Error buscando direcciones:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      latitude,
      longitude,
      maxDistanceKm = 1
    } = body;
    
    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Se requieren las coordenadas latitude y longitude' },
        { status: 400 }
      );
    }
    
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'Las coordenadas deben ser números' },
        { status: 400 }
      );
    }
    
    if (maxDistanceKm > 5) {
      return NextResponse.json(
        { error: 'La distancia máxima es 5 km' },
        { status: 400 }
      );
    }
    
    const results = await madridGeocodingService.findClosestAddress(
      latitude,
      longitude,
      maxDistanceKm
    );
    
    return NextResponse.json({
      success: true,
      data: {
        results,
        count: results.length,
        query: {
          latitude,
          longitude,
          maxDistanceKm
        }
      }
    });
    
  } catch (error) {
    console.error('Error buscando direcciones por coordenadas:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
