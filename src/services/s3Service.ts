// Importaciones condicionales para evitar problemas de build
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
let S3Client: any;
let PutObjectCommand: any;
let uuidv4: any;

// Solo importar en el servidor
if (typeof window === 'undefined') {
  try {
    const awsS3 = require('@aws-sdk/client-s3');
    S3Client = awsS3.S3Client;
    PutObjectCommand = awsS3.PutObjectCommand;
    
    const uuid = require('uuid');
    uuidv4 = uuid.v4;
  } catch (error) {
    console.warn('AWS SDK not available:', error);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
/* eslint-enable @typescript-eslint/no-require-imports */

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Sube una imagen a S3 en la carpeta /original/
 */
export async function uploadImageToS3(
  file: File,
  prefix: string = 'dea-foto'
): Promise<UploadResult> {
  if (typeof window !== 'undefined') {
    throw new Error('uploadImageToS3 can only be called on the server');
  }

  if (!S3Client || !PutObjectCommand || !uuidv4) {
    throw new Error('AWS SDK dependencies not available');
  }

  try {
    // Configuración del cliente S3
    const s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    // Generar nombre único para el archivo
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${prefix}-${uuidv4()}.${fileExtension}`;
    const key = `original/${fileName}`;

    // Convertir File a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Configurar el comando de subida
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      // Hacer el objeto público para lectura
      ACL: 'public-read',
    });

    // Subir el archivo
    await s3Client.send(command);

    // Construir la URL pública
    const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return {
      url,
      key,
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Error al subir la imagen a S3');
  }
}

/**
 * Valida que el archivo sea una imagen válida
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Validar tipo de archivo
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de archivo no válido. Solo se permiten JPG, PNG y WebP.',
    };
  }

  // Validar tamaño (máximo 3MB - reducido para evitar error 413 en Vercel)
  const maxSize = 3 * 1024 * 1024; // 3MB en bytes
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'El archivo es demasiado grande. Máximo 3MB.',
    };
  }

  return { valid: true };
}
