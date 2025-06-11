import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'URL de imagen requerida' },
        { status: 400 }
      );
    }

    // Verificar que sea una URL de SharePoint
    if (!isSharePointUrl(imageUrl)) {
      return NextResponse.json(
        { error: 'Solo se permiten URLs de SharePoint' },
        { status: 400 }
      );
    }

    // Hacer fetch de la imagen desde SharePoint
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      // Timeout de 30 segundos
      signal: AbortSignal.timeout(30000)
    });

    if (!imageResponse.ok) {
      console.error(`Error fetching image: ${imageResponse.status} ${imageResponse.statusText}`);
      return NextResponse.json(
        { error: `Error al obtener la imagen: ${imageResponse.status}` },
        { status: imageResponse.status }
      );
    }

    // Verificar que el contenido sea una imagen
    const contentType = imageResponse.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'El contenido no es una imagen válida' },
        { status: 400 }
      );
    }

    // Obtener el buffer de la imagen
    const imageBuffer = await imageResponse.arrayBuffer();

    // Crear respuesta con headers CORS apropiados
    const response = new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': imageBuffer.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache por 1 hora
        'CDN-Cache-Control': 'public, max-age=86400', // Cache en CDN por 24 horas
        'Vary': 'Accept-Encoding'
      }
    });

    return response;

  } catch (error) {
    console.error('Error in image proxy:', error);
    
    if (error instanceof Error) {
      if (error.name === 'TimeoutError') {
        return NextResponse.json(
          { error: 'Timeout al obtener la imagen' },
          { status: 408 }
        );
      }
      
      return NextResponse.json(
        { error: `Error del servidor: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función para verificar si es una URL de SharePoint
function isSharePointUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Verificar dominios de SharePoint
    return hostname.includes('sharepoint.com') || 
           hostname.includes('sharepoint-df.com') ||
           hostname.includes('sharepointonline.com');
  } catch {
    return false;
  }
}

// Manejar OPTIONS para CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
