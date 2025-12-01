// src/utils/imageLoader.ts

/**
 * Opciones para la carga de imágenes con reintentos
 */
export interface ImageLoadOptions {
  /** Número máximo de intentos (default: 3) */
  maxRetries?: number;
  /** Delay inicial entre reintentos en ms (default: 1000) */
  initialDelay?: number;
  /** Callback para reportar el estado de cada intento */
  onRetry?: (attempt: number, maxRetries: number) => void;
  /** Si debe usar cache-busting en reintentos (default: true) */
  useCacheBusting?: boolean;
  /** Si debe usar proxy como fallback (default: true) */
  useProxyFallback?: boolean;
}

/**
 * Resultado de la carga de imagen
 */
export interface ImageLoadResult {
  image: HTMLImageElement;
  attempts: number;
  usedProxy: boolean;
}

/**
 * Verifica si una URL es de S3
 */
function isS3Url(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return hostname.includes('.s3.') || hostname.includes('.s3-');
  } catch {
    return false;
  }
}

/**
 * Obtiene la URL del proxy de imágenes
 */
function getProxiedImageUrl(originalUrl: string): string {
  const proxyUrl = new URL('/api/image-proxy', window.location.origin);
  proxyUrl.searchParams.set('url', originalUrl);
  return proxyUrl.toString();
}

/**
 * Añade cache-busting a una URL
 */
function addCacheBusting(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
}

/**
 * Intenta cargar una imagen con una URL específica
 */
function attemptImageLoad(
  url: string,
  useCrossOrigin: boolean = true
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    if (useCrossOrigin) {
      img.crossOrigin = 'anonymous';
    }
    
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      console.error('❌ Error loading image:', {
        url,
        useCrossOrigin,
        error
      });
      reject(new Error(`Error al cargar la imagen: ${url}`));
    };
    
    img.src = url;
  });
}

/**
 * Espera un tiempo determinado
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Carga una imagen con reintentos automáticos y estrategias de fallback
 * 
 * Esta función implementa múltiples estrategias para cargar imágenes:
 * 1. Intento directo con crossOrigin
 * 2. Reintentos con cache-busting (añade timestamp)
 * 3. Fallback al proxy de imágenes si todo falla
 * 
 * @param src URL de la imagen a cargar
 * @param options Opciones de configuración
 * @returns Promise con el resultado de la carga
 */
export async function loadImageWithRetry(
  src: string,
  options: ImageLoadOptions = {}
): Promise<ImageLoadResult> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    onRetry,
    useCacheBusting = true,
    useProxyFallback = true
  } = options;

  console.log('🖼️  Iniciando carga de imagen:', {
    src,
    maxRetries,
    initialDelay,
    useCacheBusting,
    useProxyFallback
  });

  // Intento 1: Carga directa
  try {
    console.log('📥 Intento 1: Carga directa');
    const image = await attemptImageLoad(src, true);
    console.log('✅ Imagen cargada exitosamente en el primer intento');
    return { image, attempts: 1, usedProxy: false };
  } catch (error) {
    console.warn('⚠️  Intento 1 falló:', error);
  }

  // Intentos 2-N: Reintentos con backoff exponencial y cache-busting
  for (let attempt = 2; attempt <= maxRetries; attempt++) {
    const delay = initialDelay * Math.pow(2, attempt - 2); // Backoff exponencial
    
    console.log(`⏳ Esperando ${delay}ms antes del intento ${attempt}...`);
    await sleep(delay);

    // Notificar al UI sobre el reintento
    if (onRetry) {
      onRetry(attempt, maxRetries);
    }

    try {
      // Construir URL con cache-busting si está habilitado
      const url = useCacheBusting ? addCacheBusting(src) : src;
      
      console.log(`📥 Intento ${attempt}: Carga con ${useCacheBusting ? 'cache-busting' : 'URL original'}`);
      const image = await attemptImageLoad(url, true);
      console.log(`✅ Imagen cargada exitosamente en el intento ${attempt}`);
      return { image, attempts: attempt, usedProxy: false };
    } catch (error) {
      console.warn(`⚠️  Intento ${attempt} falló:`, error);
      
      // Si es el último intento y no hay fallback, lanzar error
      if (attempt === maxRetries && !useProxyFallback) {
        throw new Error(`No se pudo cargar la imagen después de ${maxRetries} intentos`);
      }
    }
  }

  // Fallback: Intentar con el proxy si está habilitado
  if (useProxyFallback && isS3Url(src)) {
    console.log('🔄 Todos los intentos directos fallaron. Intentando con proxy...');
    
    try {
      const proxiedUrl = getProxiedImageUrl(src);
      console.log('📥 Intento con proxy:', proxiedUrl);
      
      // El proxy no necesita crossOrigin ya que es same-origin
      const image = await attemptImageLoad(proxiedUrl, false);
      console.log('✅ Imagen cargada exitosamente a través del proxy');
      return { image, attempts: maxRetries + 1, usedProxy: true };
    } catch (error) {
      console.error('❌ Falló incluso con el proxy:', error);
      throw new Error(`No se pudo cargar la imagen ni con el proxy después de ${maxRetries} intentos`);
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  throw new Error(`No se pudo cargar la imagen después de ${maxRetries} intentos`);
}

/**
 * Alias de la función anterior para mantener compatibilidad
 * con el código existente que usa loadImageWithProxy
 */
export async function loadImageWithProxy(src: string): Promise<HTMLImageElement> {
  const result = await loadImageWithRetry(src, {
    maxRetries: 3,
    useCacheBusting: true,
    useProxyFallback: true
  });
  
  return result.image;
}
