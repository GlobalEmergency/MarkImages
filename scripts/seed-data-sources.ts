/**
 * Script para crear/actualizar las fuentes de datos externas via API.
 *
 * Uso:
 *   npx tsx scripts/seed-data-sources.ts
 *
 * Variables de entorno opcionales:
 *   BASE_URL        (default: http://localhost:3000)
 *   ADMIN_EMAIL     (default: admin@deamap.es)
 *   ADMIN_PASSWORD  (default: 123456)
 *
 * El script:
 *   1. Autentica con el endpoint /api/auth/login
 *   2. Obtiene las fuentes de datos existentes (GET /api/admin/data-sources)
 *   3. Para cada definición: POST si no existe, PUT si ya existe
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@deamap.es";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

// ============================================================
// Data source definitions (consolidated final configs)
// ============================================================

interface DataSourceDef {
  name: string;
  description: string;
  type: "CSV_FILE" | "CKAN_API" | "JSON_FILE" | "REST_API";
  sourceOrigin: string;
  countryCode: string;
  regionCode: string;
  matchingStrategy: string;
  matchingThreshold: number;
  isActive: boolean;
  syncFrequency: string;
  autoDeactivateMissing: boolean;
  autoUpdateFields: string[];
  defaultPublicationMode: string;
  config: Record<string, unknown>;
}

const DATA_SOURCES: DataSourceDef[] = [
  // ============================================================
  // 1. Comunidad de Madrid — JSON file (datos.comunidad.madrid)
  // ============================================================
  {
    name: "DEAs Comunidad de Madrid",
    description:
      "Desfibriladores externos fuera del ámbito sanitario — Datos abiertos Comunidad de Madrid",
    type: "JSON_FILE",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-MD",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "WEEKLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "JSON_FILE",
      fileUrl:
        "https://datos.comunidad.madrid/catalogo/dataset/d2478503-a4ae-4753-9540-9200071803c4/resource/42d08814-3361-4c2a-93fe-36664abc7953/download/desfibriladores_externos_fuera_ambito_sanitario.json",
      jsonPath: "data",
      fieldMappings: {
        codigo_dea: "externalId",
        direccion_via_codigo: "streetType",
        direccion_via_nombre: "streetName",
        direccion_portal_numero: "streetNumber",
        direccion_piso: "floor",
        direccion_puerta: "additionalInfo",
        direccion_ubicacion: "specificLocation",
        direccion_codigo_postal: "postalCode",
        direccion_latitud: "latitude",
        direccion_longitud: "longitude",
        municipio_codigo: "cityCode",
        municipio_nombre: "city",
        tipo_establecimiento: "establishmentType",
        tipo_titularidad: "ownershipType",
        horario_acceso: "accessSchedule",
      },
    },
  },

  // ============================================================
  // 2. Cataluña — Socrata SODA API
  // ============================================================
  {
    name: "DEAs Cataluña - Generalitat",
    description:
      "Registre de desfibril·ladors instal·lats a Catalunya fora de l'àmbit sanitari — Dades Obertes Generalitat de Catalunya (Socrata). ~11.700 registros.",
    type: "REST_API",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-CT",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "WEEKLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "REST_API",
      apiEndpoint: "https://analisi.transparenciacatalunya.cat/resource/wpud-ukyg.json",
      pagination: {
        strategy: "offset",
        limitParam: "$limit",
        limitValue: 1000,
        offsetParam: "$offset",
      },
      fieldMappings: {
        numero_inscripcio: "externalId",
        latitud: "latitude",
        longitud: "longitude",
        nom_centre: "name",
        tipus_via: "streetType",
        nom_via: "streetName",
        numero_via: "streetNumber",
        pis: "floor",
        porta: "additionalInfo",
        espai_fisic: "specificLocation",
        codi_postal: "postalCode",
        municipi: "city",
        provincia: "district",
        titular: "submitterName",
        fabricant: "deviceBrand",
        marca_model: "deviceModel",
        numero_serie: "deviceSerialNumber",
        vehicle: "observations",
      },
    },
  },

  // ============================================================
  // 3. Castilla y León — OpenDataSoft API v2.1
  // Sin coordenadas GPS → requiere geocodificación
  // ============================================================
  {
    name: "DEAs Castilla y León - Junta",
    description:
      "Registro de DESA en espacios físicos — Datos abiertos Junta de Castilla y León (OpenDataSoft). ~2.500 registros. Sin coordenadas GPS, requiere geocodificación.",
    type: "REST_API",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-CL",
    matchingStrategy: "BY_ADDRESS",
    matchingThreshold: 70,
    isActive: true,
    syncFrequency: "WEEKLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "REST_API",
      apiEndpoint:
        "https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/registro-de-desfibriladores-externos-semiautomaticos-desa-en-espacios-fisicos/records",
      responseDataPath: "results",
      pagination: {
        strategy: "offset",
        limitParam: "limit",
        limitValue: 100,
        offsetParam: "offset",
        totalCountPath: "total_count",
      },
      fieldMappings: {
        numero_serie: "deviceSerialNumber",
        empresa: "submitterName",
        ubicacion: "name",
        tipo_via: "streetType",
        via: "streetName",
        numero: "streetNumber",
        localidad: "city",
        provincia: "district",
        fecha_alta: "deviceInstallationDate",
        fecha_baja: "observations",
      },
      fieldTransformers: {
        via: ["nominatim-geocode"],
      },
    },
  },

  // ============================================================
  // 4. Euskadi — GeoJSON estático (opendata.euskadi.eus)
  // GeoJSON auto-detect extrae lat/lng de geometry.coordinates
  // ============================================================
  {
    name: "DEAs Euskadi - Gobierno Vasco",
    description:
      "Desfibriladores Externos Automatizados de Euskadi — Open Data Euskadi (GeoJSON). ~3.200 registros. 3 provincias: Bizkaia, Gipuzkoa, Araba/Álava.",
    type: "JSON_FILE",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-PV",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "JSON_FILE",
      fileUrl:
        "https://opendata.euskadi.eus/contenidos/ds_localizaciones/desfibriladores/opendata/desfibriladores.geojson",
      fieldMappings: {
        codigo_dea: "externalId",
        direccion: "streetName",
        municipio: "city",
        provincia: "district",
        organismo: "name",
        ubicacion: "accessDescription",
        horario: "accessSchedule",
        numserie: "deviceSerialNumber",
        modelo: "deviceModel",
        latitude: "latitude",
        longitude: "longitude",
      },
      fieldTransformers: {
        horario: ["spanish-schedule"],
        direccion: ["libpostal-address"],
      },
    },
  },
];

// ============================================================
// API helpers
// ============================================================

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const token = data.token as string;
  if (!token) throw new Error("No token in login response");
  return token;
}

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

interface ExistingSource {
  id: string;
  name: string;
}

async function listDataSources(token: string): Promise<ExistingSource[]> {
  const res = await fetch(`${BASE_URL}/api/admin/data-sources`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`GET data-sources failed: ${res.status}`);
  const json = await res.json();
  return (json.data || []) as ExistingSource[];
}

async function createDataSource(token: string, def: DataSourceDef): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/admin/data-sources`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(def),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST data-source "${def.name}" failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.data.id as string;
}

async function updateDataSource(token: string, id: string, def: DataSourceDef): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/data-sources/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(def),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT data-source "${def.name}" failed (${res.status}): ${text}`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`\n🔌 Connecting to ${BASE_URL}...\n`);

  // 1. Authenticate
  console.log(`🔐 Logging in as ${ADMIN_EMAIL}...`);
  const token = await login();
  console.log("   ✅ Authenticated\n");

  // 2. Get existing data sources
  const existing = await listDataSources(token);
  console.log(`📋 Existing data sources: ${existing.length}`);
  for (const ds of existing) {
    console.log(`   - ${ds.name} (${ds.id})`);
  }
  console.log();

  // 3. Upsert each definition
  for (const def of DATA_SOURCES) {
    const found = existing.find((e) => e.name === def.name);

    if (found) {
      console.log(`🔄 Updating "${def.name}" (${found.id})...`);
      await updateDataSource(token, found.id, def);
      console.log(`   ✅ Updated\n`);
    } else {
      console.log(`➕ Creating "${def.name}"...`);
      const id = await createDataSource(token, def);
      console.log(`   ✅ Created (${id})\n`);
    }
  }

  console.log("🎉 Done! All data sources are up to date.\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
