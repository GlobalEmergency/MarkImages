#!/usr/bin/env node

/**
 * Consulta y gestiona versiones en Google Play Store.
 *
 * Modos:
 *   check   - Verifica si un versionCode existe en algún track de Google Play.
 *             Escribe en GITHUB_OUTPUT: action (build|promote|skip), source_track.
 *
 *   promote - Promueve un versionCode de un track origen a un track destino.
 *
 * Uso:
 *   node google-play-version.mjs check   --version-code 1000000 --target-track production
 *   node google-play-version.mjs promote --version-code 1000000 --from-track internal --to-track production
 *
 * Variables de entorno requeridas:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON - JSON de la service account (texto plano)
 *
 * Variables de entorno opcionales:
 *   PACKAGE_NAME - Nombre del paquete (default: es.deamap.mobile)
 *   WHATSNEW_DIR - Directorio de release notes (default: mobile/whatsnew)
 */

import { google } from "googleapis";
import { readFileSync, appendFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_NAME = process.env.PACKAGE_NAME || "es.deamap.mobile";
const TRACKS = ["internal", "alpha", "beta", "production"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args[0];

  if (!["check", "promote"].includes(mode)) {
    console.error("Modo inválido. Usa: check | promote");
    process.exit(1);
  }

  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const versionCode = get("--version-code");
  if (!versionCode) {
    console.error("--version-code es requerido");
    process.exit(1);
  }

  const targetTrack = get("--target-track") || get("--to-track");
  const fromTrack = get("--from-track");

  if (mode === "check" && !targetTrack) {
    console.error("--target-track es requerido para modo check");
    process.exit(1);
  }

  if (mode === "promote") {
    if (!fromTrack || !targetTrack) {
      console.error("--from-track y --to-track son requeridos para modo promote");
      process.exit(1);
    }
  }

  return { mode, versionCode: String(versionCode), targetTrack, fromTrack };
}

function createClient() {
  const credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return google.androidpublisher({ version: "v3", auth });
}

function setOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
  console.log(`  output: ${key}=${value}`);
}

/**
 * Busca en qué track está un versionCode.
 * Devuelve el nombre del track o null si no se encontró.
 */
async function findVersionOnTracks(client, editId, versionCode) {
  for (const trackName of TRACKS) {
    try {
      const { data: track } = await client.edits.tracks.get({
        packageName: PACKAGE_NAME,
        editId,
        track: trackName,
      });

      for (const release of track.releases || []) {
        const codes = (release.versionCodes || []).map(String);
        if (codes.includes(versionCode)) {
          return { track: trackName, release };
        }
      }
    } catch (err) {
      // Track puede no existir o estar vacío, continuar
      if (err.code !== 404) {
        console.warn(`  Advertencia consultando track ${trackName}: ${err.message}`);
      }
    }
  }
  return null;
}

/**
 * Lee los archivos whatsnew/ para incluir release notes en la promoción.
 */
function loadReleaseNotes() {
  const whatsnewDir = process.env.WHATSNEW_DIR
    ? join(__dirname, "..", "..", process.env.WHATSNEW_DIR)
    : join(__dirname, "..", "..", "mobile", "whatsnew");
  const notes = [];

  const langMap = {
    "whatsnew-en-US": "en-US",
    "whatsnew-es-ES": "es-ES",
  };

  for (const [file, language] of Object.entries(langMap)) {
    const filePath = join(whatsnewDir, file);
    if (existsSync(filePath)) {
      const text = readFileSync(filePath, "utf8").trim();
      if (text) {
        notes.push({ language, text });
      }
    }
  }

  return notes.length > 0 ? notes : undefined;
}

// ---------------------------------------------------------------------------
// Modo: check
// ---------------------------------------------------------------------------

async function runCheck(client, versionCode, targetTrack) {
  console.log(`Buscando versionCode ${versionCode} en Google Play...`);
  console.log(`  paquete: ${PACKAGE_NAME}`);
  console.log(`  track destino: ${targetTrack}`);

  const { data: edit } = await client.edits.insert({ packageName: PACKAGE_NAME });

  try {
    const found = await findVersionOnTracks(client, edit.id, versionCode);

    if (!found) {
      console.log(`\n  Versión no encontrada en ningún track → se necesita build completo`);
      setOutput("action", "build");
      setOutput("source_track", "");
      return;
    }

    console.log(`\n  Versión encontrada en track: ${found.track}`);

    if (found.track === targetTrack) {
      console.log(`  Ya está en el track destino → skip`);
      setOutput("action", "skip");
      setOutput("source_track", found.track);
      return;
    }

    console.log(`  Se necesita promote de ${found.track} → ${targetTrack}`);
    setOutput("action", "promote");
    setOutput("source_track", found.track);
  } finally {
    // Descartar el edit sin commitear (solo leímos)
    await client.edits.delete({ packageName: PACKAGE_NAME, editId: edit.id }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Modo: promote
// ---------------------------------------------------------------------------

async function runPromote(client, versionCode, fromTrack, toTrack) {
  console.log(`Promoviendo versionCode ${versionCode}: ${fromTrack} → ${toTrack}`);
  console.log(`  paquete: ${PACKAGE_NAME}`);

  const { data: edit } = await client.edits.insert({ packageName: PACKAGE_NAME });

  try {
    // Verificar que la versión existe en el track origen
    const { data: sourceTrack } = await client.edits.tracks.get({
      packageName: PACKAGE_NAME,
      editId: edit.id,
      track: fromTrack,
    });

    const sourceRelease = (sourceTrack.releases || []).find((r) =>
      (r.versionCodes || []).map(String).includes(versionCode)
    );

    if (!sourceRelease) {
      console.error(`  Error: versionCode ${versionCode} no encontrado en track ${fromTrack}`);
      process.exit(1);
    }

    console.log(`  Release encontrado en ${fromTrack}: status=${sourceRelease.status}`);

    // Preparar release notes (usar whatsnew/ si existen, sino las del release original)
    const releaseNotes = loadReleaseNotes() || sourceRelease.releaseNotes;

    // Actualizar el track destino
    await client.edits.tracks.update({
      packageName: PACKAGE_NAME,
      editId: edit.id,
      track: toTrack,
      requestBody: {
        track: toTrack,
        releases: [
          {
            versionCodes: [versionCode],
            status: "completed",
            ...(releaseNotes ? { releaseNotes } : {}),
          },
        ],
      },
    });

    // Commitear el edit
    await client.edits.commit({
      packageName: PACKAGE_NAME,
      editId: edit.id,
    });

    console.log(`\n  Promote completado: ${fromTrack} → ${toTrack}`);
  } catch (err) {
    // Intentar descartar el edit si falló
    await client.edits.delete({ packageName: PACKAGE_NAME, editId: edit.id }).catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { mode, versionCode, targetTrack, fromTrack } = parseArgs();
  const client = createClient();

  if (mode === "check") {
    await runCheck(client, versionCode, targetTrack);
  } else {
    await runPromote(client, versionCode, fromTrack, targetTrack);
  }
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
