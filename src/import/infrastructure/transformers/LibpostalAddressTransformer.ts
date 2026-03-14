/**
 * Transformer: Parser de direcciones españolas via libpostal (Docker HTTP)
 * Capa de Infraestructura
 *
 * Llama al servicio pelias/libpostal-service en Docker para parsear
 * direcciones de texto libre en campos estructurados.
 *
 * Resiliencia:
 * - Si el servicio no está disponible, retorna confidence 0 (fallback a fieldMapping)
 * - Health check al primer uso: si falla, desactiva el transformer durante
 *   CIRCUIT_BREAKER_COOLDOWN_MS para evitar timeouts en cada registro
 * - Log claro en consola indicando el estado (disponible/no disponible)
 *
 * Configuración vía env vars:
 * - LIBPOSTAL_HOST: hostname del servicio (default: "127.0.0.1")
 * - LIBPOSTAL_PORT: puerto HTTP (default: "4400")
 */

import type { IFieldTransformer, TransformerResult } from "@/import/domain/ports/IFieldTransformer";

const LIBPOSTAL_HOST = process.env.LIBPOSTAL_HOST || "127.0.0.1";
const LIBPOSTAL_PORT = process.env.LIBPOSTAL_PORT || "4400";
const LIBPOSTAL_TIMEOUT_MS = 2_000;

/**
 * Tiempo que el circuit breaker permanece abierto tras un fallo de conectividad.
 * Mientras esté abierto, transform() devuelve directamente confidence 0 sin
 * intentar la conexión HTTP, evitando N timeouts en cada registro.
 */
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Tipos de vía que aparecen como PREFIJO (castellano, catalán, gallego, abreviaturas).
 * Ej: "CALLE Gran Vía" → streetType="Calle", streetName="Gran Vía"
 * Ordenados de más largo a más corto para evitar matches parciales.
 */
const PREFIX_STREET_TYPES = [
  // === Castellano (largos primero) ===
  "CARRETERA",
  "COSTANILLA",
  "TRAVESIA",
  "TRAVESÍA",
  "GLORIETA",
  "URBANIZACIÓN",
  "URBANIZACION",
  "POLÍGONO",
  "POLIGONO",
  "AVENIDA",
  "ALAMEDA",
  "BULEVAR",
  "CALLEJON",
  "CALLEJÓN",
  "CAMINO",
  "PASAJE",
  "PARQUE",
  "RAMBLA",
  "RIBERA",
  "BARRIO",
  "CALLE",
  "PASEO",
  "PLAZA",
  "RONDA",
  "CUESTA",
  "PLAYA",
  "LUGAR",
  "PORTAL",
  "PATIO",
  // === Catalán ===
  "TRAVESSERA", // Travesía
  "AVINGUDA", // Avenida
  "PASSEIG", // Paseo
  "CARRER", // Calle
  "PLAÇA", // Plaza
  "CAMÍ", // Camino
  "CAMI", // Camino (sin acento)
  // === Gallego ===
  "ESTRADA", // Carretera
  "PRAZA", // Plaza
  "RÚA", // Calle
  "RUA", // Calle (sin acento)
  // === Abreviaturas ===
  "CTRA",
  "AVDA",
  "AVDA.",
  "AVD",
  "AV.",
  "AV",
  "PZA.",
  "PZA",
  "PZ.",
  "PZ",
  "PS.",
  "PS",
  "CM.",
  "CM",
  "CL.",
  "CL",
  "CR.",
  "CR",
  "C/",
];

/**
 * Tipos de vía vascos que aparecen como SUFIJO (postfijo).
 * En euskera, el tipo de vía va al final: "Txurrua KALEA" = "Calle Txurrua"
 * Ordenados de más largo a más corto.
 */
const BASQUE_SUFFIX_STREET_TYPES = [
  "ZUMARKALEA", // Alameda
  "PASEALEKUA", // Paseo
  "ETORBIDEA", // Avenida
  "ENPARANTZA", // Plaza
  "PASEALEKU", // Paseo (sin artículo)
  "ETORBIDE", // Avenida (sin artículo)
  "KALEA", // Calle (con artículo)
  "BIDEA", // Camino (con artículo)
  "KALE", // Calle
  "BIDE", // Camino
];

interface LibpostalComponent {
  label: string;
  value: string;
}

export class LibpostalAddressTransformer implements IFieldTransformer {
  readonly name = "libpostal-address";

  /** Estado del circuit breaker */
  private circuitOpen = false;
  private circuitOpenedAt = 0;

  /** Solo logueamos el estado una vez para no spammear */
  private hasLoggedAvailability = false;
  private hasLoggedUnavailability = false;

  async transform(
    value: string,
    _context?: Record<string, string | null>
  ): Promise<TransformerResult> {
    const fields: Record<string, string | null> = {};

    // Circuit breaker: si el servicio está caído, no intentar durante el cooldown
    if (this.isCircuitOpen()) {
      return { fields: {}, confidence: 0, rawValue: value };
    }

    try {
      const components = await this.callLibpostal(value);

      if (!components || components.length === 0) {
        return { fields, confidence: 0, rawValue: value };
      }

      // Primera llamada exitosa → log disponibilidad
      if (!this.hasLoggedAvailability) {
        console.log(
          `✅ libpostal-address: servicio disponible en ${LIBPOSTAL_HOST}:${LIBPOSTAL_PORT}`
        );
        this.hasLoggedAvailability = true;
        this.hasLoggedUnavailability = false;
      }

      // Mapear componentes de libpostal a campos normalizados
      for (const comp of components) {
        switch (comp.label) {
          case "house_number":
            fields.streetNumber = comp.value;
            break;
          case "road": {
            const { streetType, streetName } = this.splitStreetTypeAndName(comp.value);
            fields.streetType = streetType;
            fields.streetName = streetName;
            break;
          }
          case "house": {
            // libpostal clasifica algunas direcciones (ej: nombres vascos) como "house"
            // en lugar de "road" + "house_number". Intentamos separar nombre y número.
            const parsed = this.parseHouseLabel(comp.value);
            if (parsed.streetName && !fields.streetName) {
              fields.streetName = parsed.streetName;
            }
            if (parsed.streetNumber && !fields.streetNumber) {
              fields.streetNumber = parsed.streetNumber;
            }
            break;
          }
          case "postcode":
            fields.postalCode = comp.value;
            break;
          case "city":
          case "city_district":
            if (!fields.city) fields.city = comp.value;
            break;
          case "suburb":
          case "neighbourhood":
            if (!fields.neighborhood) fields.neighborhood = comp.value;
            break;
          case "state":
          case "state_district":
            if (!fields.district) fields.district = comp.value;
            break;
          case "level":
            fields.floor = comp.value;
            break;
        }
      }

      // Capitalize fields properly
      for (const key of Object.keys(fields)) {
        if (fields[key]) {
          fields[key] = this.titleCase(fields[key]!);
        }
      }

      const hasStreet = !!fields.streetName;
      const confidence = hasStreet ? 0.85 : 0.3;

      return { fields, confidence, rawValue: value };
    } catch {
      // Service unavailable → abrir circuit breaker
      this.openCircuit();
      return { fields: {}, confidence: 0, rawValue: value };
    }
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
        `⚠️ libpostal-address: servicio NO disponible en ${LIBPOSTAL_HOST}:${LIBPOSTAL_PORT}. ` +
          `Las direcciones se guardarán en bruto (fallback). ` +
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
      // Cooldown expirado → cerrar circuito, dejar que reintente
      this.circuitOpen = false;
      console.log(`🔄 libpostal-address: reintentando conexión tras cooldown...`);
      return false;
    }

    return true;
  }

  // ============================================================
  // HTTP
  // ============================================================

  /**
   * Llama al servicio libpostal via HTTP
   */
  private async callLibpostal(address: string): Promise<LibpostalComponent[]> {
    const url = `http://${LIBPOSTAL_HOST}:${LIBPOSTAL_PORT}/parse?address=${encodeURIComponent(address)}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(LIBPOSTAL_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`libpostal HTTP ${response.status}`);
    }

    return (await response.json()) as LibpostalComponent[];
  }

  // ============================================================
  // Parsing helpers
  // ============================================================

  /**
   * Parsea el label "house" de libpostal.
   * Cuando libpostal no reconoce una dirección (ej: nombres vascos como "txurrua 1"),
   * clasifica todo como "house". Intentamos separar el número del nombre.
   *
   * Ej: "txurrua 1" → { streetName: "txurrua", streetNumber: "1" }
   * Ej: "txurrua 1 plentzia" → { streetName: "txurrua", streetNumber: "1" }
   *     (las palabras posteriores al número se ignoran, ya que suelen ser ciudad/contexto)
   */
  private parseHouseLabel(houseValue: string): {
    streetName: string | null;
    streetNumber: string | null;
  } {
    const parts = houseValue.trim().split(/\s+/);
    if (parts.length < 2) {
      // Solo una palabra — podría ser el nombre pero no podemos separar
      return { streetName: houseValue, streetNumber: null };
    }

    // Buscar el primer token numérico (ej: "1", "44", "3B")
    for (let i = 1; i < parts.length; i++) {
      if (/^\d+\w?$/.test(parts[i])) {
        const streetName = parts.slice(0, i).join(" ");
        const streetNumber = parts[i];
        return { streetName, streetNumber };
      }
    }

    // Sin número encontrado — devolver todo como nombre
    return { streetName: houseValue, streetNumber: null };
  }

  /**
   * Separa tipo de vía del nombre usando diccionario multilingüe.
   *
   * Soporta dos patrones:
   * - Prefijo (castellano/catalán/gallego): "CALLE Gran Vía" → streetType="Calle"
   * - Sufijo (euskera): "Txurrua KALEA" → streetType="Kalea"
   */
  private splitStreetTypeAndName(road: string): {
    streetType: string | null;
    streetName: string;
  } {
    const upper = road.toUpperCase().trim();

    // 1. Buscar prefijos (castellano, catalán, gallego, abreviaturas)
    for (const type of PREFIX_STREET_TYPES) {
      if (upper.startsWith(type + " ") || upper.startsWith(type + ".")) {
        const rest = road
          .substring(type.length)
          .replace(/^[.\s]+/, "")
          .trim();
        return {
          streetType: this.titleCase(type.replace(/[./]$/, "")),
          streetName: rest || road,
        };
      }
    }

    // 2. Buscar sufijos vascos: "txurrua kalea" → type="Kalea", name="Txurrua"
    for (const type of BASQUE_SUFFIX_STREET_TYPES) {
      if (upper.endsWith(" " + type)) {
        const rest = road.substring(0, road.length - type.length).trim();
        return {
          streetType: this.titleCase(type),
          streetName: rest || road,
        };
      }
    }

    // No type found — return full road as streetName
    return { streetType: null, streetName: road };
  }

  /**
   * Convierte a Title Case
   */
  private titleCase(str: string): string {
    return str.toLowerCase().replace(/(?:^|\s|[/-])\S/g, (char) => char.toUpperCase());
  }
}
