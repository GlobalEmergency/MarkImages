// src/utils/imageLoader.ts

/**
 * Opciones para la carga de imÃ¡genes con reintentos
 */
export interface ImageLoadOptions {
  /** NÃºmero mÃ¡ximo de intentos (default: 3) */
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
    return hostname.includes(".s3.") || hostname.includes(".s3-");
  } catch {
    return false;
  }
}

/**
 * Obtiene la URL del proxy de imÃ¡genes
 */
function getProxiedImageUrl(originalUrl: string): string {
  const proxyUrl = new URL("/api/image-proxy", window.location.origin);
  proxyUrl.searchParams.set("url", originalUrl);
  return proxyUrl.toString();
}

/**
 * AÃ±ade cache-busting a una URL
 */
function addCacheBusting(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
}

/**
 * Intenta cargar una imagen con una URL especÃ­fica
 */
function attemptImageLoad(url: string, useCrossOrigin: boolean = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    if (useCrossOrigin) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => resolve(img);
    img.onerror = (error) => {
      console.error("âŒ Error loading image:", {
        url,
        useCrossOrigin,
        error,
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Carga una imagen con reintentos automÃ¡ticos y estrategias de fallback
 *
 * Esta funciÃ³n implementa mÃºltiples estrategias para cargar imÃ¡genes:
 * 1. Intento directo con crossOrigin
 * 2. Reintentos con cache-busting (aÃ±ade timestamp)
 * 3. Fallback al proxy de imÃ¡genes si todo falla
 *
 * @param src URL de la imagen a cargar
 * @param options Opciones de configuraciÃ³n
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
    useProxyFallback = true,
  } = options;

  // Intento 1: Carga directa
  try {
    const image = await attemptImageLoad(src, true);

    return { image, attempts: 1, usedProxy: false };
  } catch {
    /* Ignored */
  }

  // Intentos 2-N: Reintentos con backoff exponencial y cache-busting
  for (let attempt = 2; attempt <= maxRetries; attempt++) {
    const delay = initialDelay * Math.pow(2, attempt - 2); // Backoff exponencial

    await sleep(delay);

    // Notificar al UI sobre el reintento
    if (onRetry) {
      onRetry(attempt, maxRetries);
    }

    try {
      // Construir URL con cache-busting si estÃ¡ habilitado
      const url = useCacheBusting ? addCacheBusting(src) : src;

      const image = await attemptImageLoad(url, true);

      return { image, attempts: attempt, usedProxy: false };
    } catch {
      // Si es el Ãºltimo intento y no hay fallback, lanzar error
      if (attempt === maxRetries && !useProxyFallback) {
        throw new Error(`No se pudo cargar la imagen despuÃ©s de ${maxRetries} intentos`);
      }
    }
  }

  // Fallback: Intentar con el proxy si estÃ¡ habilitado
  if (useProxyFallback && isS3Url(src)) {
    try {
      const proxiedUrl = getProxiedImageUrl(src);

      // El proxy no necesita crossOrigin ya que es same-origin
      const image = await attemptImageLoad(proxiedUrl, false);

      return { image, attempts: maxRetries + 1, usedProxy: true };
    } catch (error) {
      console.error("âŒ FallÃ³ incluso con el proxy:", error);
      throw new Error(
        `No se pudo cargar la imagen ni con el proxy despuÃ©s de ${maxRetries} intentos`
      );
    }
  }

  // Si llegamos aquÃ­, todos los intentos fallaron
  throw new Error(`No se pudo cargar la imagen despuÃ©s de ${maxRetries} intentos`);
}

/**
 * Alias de la funciÃ³n anterior para mantener compatibilidad
 * con el cÃ³digo existente que usa loadImageWithProxy
 */
export async function loadImageWithProxy(src: string): Promise<HTMLImageElement> {
  const result = await loadImageWithRetry(src, {
    maxRetries: 3,
    useCacheBusting: true,
    useProxyFallback: true,
  });

  return result.image;
}
