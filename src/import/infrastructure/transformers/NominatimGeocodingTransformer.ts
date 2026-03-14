/**
 * Transformer: Geocodificación de direcciones vía Nominatim (Docker HTTP)
 * Capa de Infraestructura
 *
 * Llama al servicio mediagis/nominatim en Docker para geocodificar direcciones
 * españolas en coordenadas (latitude, longitude) y código postal.
 *
 * A diferencia de LibpostalAddressTransformer (que parsea UNA dirección en campos),
 * este transformer COMPONE una dirección desde campos ya mapeados (vía context)
 * y la geocodifica.
 *
 * Resiliencia:
 * - Circuit breaker: si el servicio no está disponible, retorna confidence 0
 *   durante CIRCUIT_BREAKER_COOLDOWN_MS (fallback a datos sin coordenadas)
 * - Rate limiting: MIN_REQUEST_INTERVAL_MS entre peticiones para no saturar
 * - Dual query: structured query primero, free-form como fallback
 *
 * Configuración vía env vars:
 * - NOMINATIM_HOST: hostname del servicio (default: "127.0.0.1")
 * - NOMINATIM_PORT: puerto HTTP (default: "8080")
 */

import type { IFieldTransformer, TransformerResult } from "@/import/domain/ports/IFieldTransformer";

const NOMINATIM_HOST = process.env.NOMINATIM_HOST || "127.0.0.1";
const NOMINATIM_PORT = process.env.NOMINATIM_PORT || "8080";
const NOMINATIM_TIMEOUT_MS = 5_000; // Geocoding puede ser más lento que parsing
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos
const MIN_REQUEST_INTERVAL_MS = 100; // 10 req/s para self-hosted

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
}

export class NominatimGeocodingTransformer implements IFieldTransformer {
  readonly name = "nominatim-geocode";

  /** Circuit breaker state */
  private circuitOpen = false;
  private circuitOpenedAt = 0;
  private hasLoggedAvailability = false;
  private hasLoggedUnavailability = false;

  /** Rate limiting */
  private lastRequestTime = 0;

  async transform(
    value: string,
    context?: Record<string, string | null>
  ): Promise<TransformerResult> {
    // Circuit breaker: si el servicio está caído, no intentar durante el cooldown
    if (this.isCircuitOpen()) {
      return { fields: {}, confidence: 0, rawValue: value };
    }

    // Componer dirección desde contexto (campos ya mapeados) o valor directo
    const address = this.composeAddress(value, context);
    if (!address) {
      return { fields: {}, confidence: 0, rawValue: value };
    }

    try {
      // Rate limiting
      await this.throttle();

      // Intentar query estructurada primero (mejor para campos ya separados)
      let result = await this.callNominatimStructured(context);

      // Fallback a query libre si la estructurada no da resultados
      if (!result) {
        await this.throttle();
        result = await this.callNominatimFreeForm(address);
      }

      if (!result) {
        return { fields: {}, confidence: 0, rawValue: address };
      }

      // Primera llamada exitosa → log disponibilidad
      if (!this.hasLoggedAvailability) {
        console.log(
          `✅ nominatim-geocode: servicio disponible en ${NOMINATIM_HOST}:${NOMINATIM_PORT}`
        );
        this.hasLoggedAvailability = true;
        this.hasLoggedUnavailability = false;
      }

      return this.buildResult(result, address, context);
    } catch (error) {
      // Service unavailable → abrir circuit breaker
      console.error(
        `❌ nominatim-geocode: error al geocodificar "${address}":`,
        error instanceof Error ? error.message : error
      );
      this.openCircuit();
      return { fields: {}, confidence: 0, rawValue: address };
    }
  }

  // ============================================================
  // Address Composition
  // ============================================================

  /**
   * Compone una dirección completa desde los campos del contexto.
   * El contexto contiene los valores ya mapeados: streetType, streetName,
   * streetNumber, city, district (provincia).
   *
   * Ej: "CALLE LAGAR, SAELICES DE MAYORGA, VALLADOLID, España"
   */
  private composeAddress(value: string, context?: Record<string, string | null>): string | null {
    if (!context) return value || null;

    const streetType = context.streetType || "";
    const streetName = context.streetName || "";
    const streetNumber = this.normalizeStreetNumber(context.streetNumber);
    const city = context.city || "";
    const district = context.district || "";

    // Si no hay al menos calle y ciudad, usar el valor directo
    if (!streetName && !city) {
      return value || null;
    }

    const parts: string[] = [];

    // Calle: "CALLE LAGAR 5" o "CALLE LAGAR" (sin número)
    const streetParts = [streetType, streetName, streetNumber].filter(Boolean);
    if (streetParts.length > 0) {
      parts.push(streetParts.join(" "));
    }

    if (city) parts.push(city);
    if (district) parts.push(district);
    parts.push("España");

    return parts.join(", ");
  }

  /**
   * Normaliza el número de calle.
   * CyL usa "0" para sin número; lo filtramos para no confundir a Nominatim.
   */
  private normalizeStreetNumber(num: string | null | undefined): string {
    if (!num || num === "0" || num === "S/N" || num.toUpperCase() === "SN") {
      return "";
    }
    return num;
  }

  // ============================================================
  // Nominatim API Calls
  // ============================================================

  /**
   * Query estructurada: usa campos separados para mejor precisión.
   * Ideal para fuentes con campos ya desglosados (CyL, Cataluña).
   */
  private async callNominatimStructured(
    context?: Record<string, string | null>
  ): Promise<NominatimResult | null> {
    if (!context) return null;

    const streetType = context.streetType || "";
    const streetName = context.streetName || "";
    const streetNumber = this.normalizeStreetNumber(context.streetNumber);
    const city = context.city || "";
    const district = context.district || "";

    // Necesitamos al menos calle o ciudad
    if (!streetName && !city) return null;

    const params = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      countrycodes: "es",
      addressdetails: "1",
    });

    // Componer campo street: "CALLE LAGAR 5"
    const street = [streetType, streetName, streetNumber].filter(Boolean).join(" ");
    if (street) params.set("street", street);
    if (city) params.set("city", city);
    if (district) params.set("state", district);
    params.set("country", "España");

    const url = `http://${NOMINATIM_HOST}:${NOMINATIM_PORT}/search?${params.toString()}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    const results = (await response.json()) as NominatimResult[];
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Query libre: envía la dirección completa como texto.
   * Fallback cuando la query estructurada no da resultados.
   */
  private async callNominatimFreeForm(address: string): Promise<NominatimResult | null> {
    const params = new URLSearchParams({
      q: address,
      format: "jsonv2",
      limit: "1",
      countrycodes: "es",
      addressdetails: "1",
    });

    const url = `http://${NOMINATIM_HOST}:${NOMINATIM_PORT}/search?${params.toString()}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    const results = (await response.json()) as NominatimResult[];
    return results.length > 0 ? results[0] : null;
  }

  // ============================================================
  // Result Mapping
  // ============================================================

  /**
   * Construye el TransformerResult a partir de la respuesta de Nominatim.
   * Extrae latitude, longitude y opcionalmente postalCode.
   */
  private buildResult(
    nominatim: NominatimResult,
    rawAddress: string,
    context?: Record<string, string | null>
  ): TransformerResult {
    const fields: Record<string, string | null> = {
      latitude: nominatim.lat,
      longitude: nominatim.lon,
    };

    // Extraer código postal si está disponible y no lo tenemos ya
    const postcode = nominatim.address?.postcode;
    if (postcode && !context?.postalCode) {
      fields.postalCode = postcode;
    }

    const confidence = this.calculateConfidence(nominatim, context);

    return { fields, confidence, rawValue: rawAddress };
  }

  /**
   * Calcula la confianza del resultado basándose en la calidad del match.
   */
  private calculateConfidence(
    result: NominatimResult,
    context?: Record<string, string | null>
  ): number {
    let confidence = 0.5; // Base: tenemos coordenadas

    // Bonus por código postal
    if (result.address?.postcode) {
      confidence += 0.1;
    }

    // Bonus por match de calle
    if (result.address?.road && context?.streetName) {
      const resultRoad = result.address.road.toUpperCase();
      const contextStreet = context.streetName.toUpperCase();
      if (resultRoad.includes(contextStreet) || contextStreet.includes(resultRoad)) {
        confidence += 0.15;
      }
    }

    // Bonus por match de ciudad
    if (context?.city) {
      const contextCity = context.city.toUpperCase();
      const resultCity = (
        result.address?.city ||
        result.address?.town ||
        result.address?.village ||
        result.address?.municipality ||
        ""
      ).toUpperCase();
      if (resultCity.includes(contextCity) || contextCity.includes(resultCity)) {
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 0.9);
  }

  // ============================================================
  // Circuit Breaker
  // ============================================================

  /**
   * Abre el circuit breaker: durante CIRCUIT_BREAKER_COOLDOWN_MS
   * todas las llamadas a transform() devuelven confidence 0 sin HTTP.
   */
  private openCircuit(): void {
    this.circuitOpen = true;
    this.circuitOpenedAt = Date.now();

    if (!this.hasLoggedUnavailability) {
      console.warn(
        `⚠️ nominatim-geocode: servicio NO disponible en ${NOMINATIM_HOST}:${NOMINATIM_PORT}. ` +
          `Los registros se guardarán sin coordenadas (fallback). ` +
          `Se reintentará en ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000 / 60} minutos.`
      );
      this.hasLoggedUnavailability = true;
      this.hasLoggedAvailability = false;
    }
  }

  /**
   * Comprueba si el circuit breaker sigue abierto.
   * Se cierra automáticamente tras el cooldown para reintentar.
   */
  private isCircuitOpen(): boolean {
    if (!this.circuitOpen) return false;

    const elapsed = Date.now() - this.circuitOpenedAt;
    if (elapsed >= CIRCUIT_BREAKER_COOLDOWN_MS) {
      this.circuitOpen = false;
      console.log(`🔄 nominatim-geocode: reintentando conexión tras cooldown...`);
      return false;
    }

    return true;
  }

  // ============================================================
  // Rate Limiting
  // ============================================================

  /**
   * Throttle: espera hasta que haya pasado MIN_REQUEST_INTERVAL_MS
   * desde la última petición. Evita saturar Nominatim.
   */
  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
