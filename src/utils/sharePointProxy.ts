// src/utils/sharePointProxy.ts

/**
 * Verifica si una URL es de SharePoint
 */
export function isSharePointUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return hostname.includes('sharepoint.com') || 
           hostname.includes('sharepoint-df.com') ||
           hostname.includes('sharepointonline.com');
  } catch {
    return false;
  }
}

/**
 * Convierte una URL de SharePoint a una URL del proxy
 */
export function getProxiedImageUrl(originalUrl: string): string {
  if (!isSharePointUrl(originalUrl)) {
    return originalUrl;
  }
  
  // Crear URL del proxy
  const proxyUrl = new URL('/api/image-proxy', window.location.origin);
  proxyUrl.searchParams.set('url', originalUrl);
  
  return proxyUrl.toString();
}

/**
 * Función helper para cargar imágenes que maneja automáticamente SharePoint
 */
export function loadImageWithProxy(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Si es SharePoint, usar el proxy; si no, usar crossOrigin
    if (isSharePointUrl(src)) {
      img.src = getProxiedImageUrl(src);
    } else {
      img.crossOrigin = 'anonymous';
      img.src = src;
    }
    
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      console.error('Error loading image:', error);
      reject(new Error(`Error al cargar la imagen: ${src}`));
    };
  });
}
