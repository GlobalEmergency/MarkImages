/**
 * API Endpoint: Validar Cookies de SharePoint
 * Verifica que las cookies configuradas en .env son válidas
 * y permiten descargar imágenes desde SharePoint
 */

import { NextRequest, NextResponse } from "next/server";

import { SharePointImageDownloader } from "@/infrastructure/storage/adapters/SharePointImageDownloader";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testImageUrl, customCookies } = body;

    // Validar que se proporcionó URL de prueba
    if (!testImageUrl || typeof testImageUrl !== "string") {
      return NextResponse.json(
        {
          valid: false,
          message: "Se requiere una URL de imagen de prueba",
          details: {
            error: "Missing testImageUrl parameter",
          },
        },
        { status: 400 }
      );
    }

    // Validar que se proporcionaron cookies personalizadas
    if (!customCookies || typeof customCookies !== "object") {
      return NextResponse.json(
        {
          valid: false,
          message: "Se requieren cookies de SharePoint para validar",
          details: {
            error: "customCookies parameter is required",
          },
        },
        { status: 400 }
      );
    }

    const sharepointCookies = customCookies;

    // Verificar que las cookies tengan al menos una requerida
    if (!sharepointCookies.FedAuth && !sharepointCookies.rtFa) {
      return NextResponse.json(
        {
          valid: false,
          message: "Las cookies deben incluir FedAuth o rtFa",
          details: {
            error: "Missing required cookies (FedAuth or rtFa)",
          },
        },
        { status: 400 }
      );
    }

    // Validar autenticación usando SharePointImageDownloader
    const downloader = new SharePointImageDownloader();
    const validationResult = await downloader.validateAuthentication(testImageUrl, {
      type: "cookies",
      cookies: sharepointCookies,
    });

    // Devolver resultado de validación
    return NextResponse.json(validationResult, {
      status: validationResult.valid ? 200 : 400,
    });
  } catch (error) {
    console.error("Error validating SharePoint cookies:", error);

    return NextResponse.json(
      {
        valid: false,
        message: "Error interno al validar cookies",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
