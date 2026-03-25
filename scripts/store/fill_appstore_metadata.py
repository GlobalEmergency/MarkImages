#!/usr/bin/env python3
"""
Fill App Store Connect metadata for DeaMap via API.

Discovers APP_INFO_ID, VERSION_ID and LOCALE_IDs dynamically so
the script works across versions without manual ID updates.

Usage:
    python scripts/store/fill_appstore_metadata.py
"""
import jwt, time, json, urllib.request, urllib.error, ssl, os, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))

# --- Auth (same org key as NavajaSuizaSanitaria) ---
P8_PATH = os.path.join(PROJECT_DIR, "mobile", "keystores", "apple", "AuthKey_5D89M93DP2.p8")
KEY_ID = "5D89M93DP2"
ISSUER_ID = "90591e44-9746-48f0-b603-f19bf8d517aa"

with open(P8_PATH, "r") as f:
    private_key = f.read()

now = int(time.time())
token = jwt.encode(
    {"iss": ISSUER_ID, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"},
    private_key, algorithm="ES256",
    headers={"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}
)
ctx = ssl.create_default_context()
BASE = "https://api.appstoreconnect.apple.com/v1"

# --- DeaMap App Store ID (from URL: /id6760004634) ---
APP_ID = "6760004634"


def api_call(method, url, data=None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })
    try:
        resp = urllib.request.urlopen(req, context=ctx)
        content = resp.read()
        return json.loads(content) if content else {"ok": True}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR {e.code}: {err[:500]}")
        return None


# ============================================================
# 1. Discover IDs dynamically
# ============================================================

print("=" * 60)
print("DeaMap — App Store Connect Metadata")
print("=" * 60)

# Get App Info ID
print("\n1. Discovering App Info ID...")
app_infos = api_call("GET", f"{BASE}/apps/{APP_ID}/appInfos")
APP_INFO_ID = None
if app_infos and "data" in app_infos:
    # Take the most recent (last) appInfo
    APP_INFO_ID = app_infos["data"][-1]["id"]
    print(f"   APP_INFO_ID = {APP_INFO_ID}")
else:
    print("   FATAL: Could not get App Info ID")
    sys.exit(1)

# Get latest editable App Store Version (or create a new one)
EDITABLE_STATES = "PREPARE_FOR_SUBMISSION,DEVELOPER_REJECTED,REJECTED"
print("\n2. Discovering latest editable App Store Version...")
versions = api_call("GET", f"{BASE}/apps/{APP_ID}/appStoreVersions?filter[appStoreState]={EDITABLE_STATES}")
VERSION_ID = None
ver_string = None
if versions and "data" in versions and versions["data"]:
    VERSION_ID = versions["data"][0]["id"]
    ver_string = versions["data"][0]["attributes"].get("versionString", "?")
    state = versions["data"][0]["attributes"].get("appStoreState", "?")
    print(f"   Found editable version: {VERSION_ID} (v{ver_string}, state={state})")
else:
    # No editable version — find the current live version and bump it
    print("   No editable version found. Looking for current live version...")
    all_versions = api_call("GET", f"{BASE}/apps/{APP_ID}/appStoreVersions")
    if all_versions and "data" in all_versions and all_versions["data"]:
        current = all_versions["data"][0]
        current_ver = current["attributes"].get("versionString", "1.0.0")
        state = current["attributes"].get("appStoreState", "?")
        print(f"   Current version: v{current_ver} (state={state})")

        # Bump patch version
        parts = current_ver.split(".")
        parts[-1] = str(int(parts[-1]) + 1)
        new_ver = ".".join(parts)
        print(f"   Creating new version v{new_ver}...")

        result = api_call("POST", f"{BASE}/appStoreVersions", {
            "data": {
                "type": "appStoreVersions",
                "attributes": {
                    "versionString": new_ver,
                    "platform": "IOS"
                },
                "relationships": {
                    "app": {
                        "data": {"type": "apps", "id": APP_ID}
                    }
                }
            }
        })
        if result and "data" in result:
            VERSION_ID = result["data"]["id"]
            ver_string = new_ver
            print(f"   Created: VERSION_ID = {VERSION_ID} (v{new_ver})")
        else:
            print("   FATAL: Could not create new version")
            sys.exit(1)
    else:
        print("   FATAL: Could not get any App Store Version")
        sys.exit(1)

# Get existing App Info localizations
print("\n3. Discovering App Info localizations...")
info_locs = api_call("GET", f"{BASE}/appInfos/{APP_INFO_ID}/appInfoLocalizations")
INFO_LOC_ES = None
INFO_LOC_EN = None
if info_locs and "data" in info_locs:
    for loc in info_locs["data"]:
        locale = loc["attributes"]["locale"]
        if locale == "es-ES":
            INFO_LOC_ES = loc["id"]
            print(f"   es-ES info loc: {INFO_LOC_ES}")
        elif locale == "en-US":
            INFO_LOC_EN = loc["id"]
            print(f"   en-US info loc: {INFO_LOC_EN}")

# Get existing version localizations
print("\n4. Discovering version localizations...")
ver_locs = api_call("GET", f"{BASE}/appStoreVersions/{VERSION_ID}/appStoreVersionLocalizations")
VER_LOC_ES = None
VER_LOC_EN = None
if ver_locs and "data" in ver_locs:
    for vl in ver_locs["data"]:
        locale = vl["attributes"]["locale"]
        if locale == "es-ES":
            VER_LOC_ES = vl["id"]
            print(f"   es-ES version loc: {VER_LOC_ES}")
        elif locale == "en-US":
            VER_LOC_EN = vl["id"]
            print(f"   en-US version loc: {VER_LOC_EN}")


# ============================================================
# 2. Spanish App Info (name, subtitle, privacy)
# ============================================================

print("\n5. Updating Spanish app info...")
if INFO_LOC_ES:
    result = api_call("PATCH", f"{BASE}/appInfoLocalizations/{INFO_LOC_ES}", {
        "data": {
            "type": "appInfoLocalizations",
            "id": INFO_LOC_ES,
            "attributes": {
                "name": "DeaMap",
                "subtitle": "Desfibriladores cercanos",
                "privacyPolicyUrl": "https://www.deamap.es/privacy"
            }
        }
    })
    if result: print("   OK")
else:
    print("   Creating es-ES info localization...")
    result = api_call("POST", f"{BASE}/appInfoLocalizations", {
        "data": {
            "type": "appInfoLocalizations",
            "attributes": {
                "locale": "es-ES",
                "name": "DeaMap",
                "subtitle": "Desfibriladores cercanos",
                "privacyPolicyUrl": "https://www.deamap.es/privacy"
            },
            "relationships": {
                "appInfo": {"data": {"type": "appInfos", "id": APP_INFO_ID}}
            }
        }
    })
    if result and "data" in result:
        INFO_LOC_ES = result["data"]["id"]
        print(f"   OK — created {INFO_LOC_ES}")


# ============================================================
# 3. Set categories (Medical + Navigation)
# ============================================================

print("\n6. Setting categories...")
result = api_call("PATCH", f"{BASE}/appInfos/{APP_INFO_ID}", {
    "data": {
        "type": "appInfos",
        "id": APP_INFO_ID,
        "relationships": {
            "primaryCategory": {
                "data": {"type": "appCategories", "id": "MEDICAL"}
            },
            "secondaryCategory": {
                "data": {"type": "appCategories", "id": "NAVIGATION"}
            }
        }
    }
})
if result: print("   OK — Primary: Medical, Secondary: Navigation")


# ============================================================
# 4. Spanish version description
# ============================================================

DESCRIPTION_ES = (
    "DeaMap te ayuda a localizar el desfibrilador (DEA) mas cercano "
    "en caso de emergencia. Cada segundo cuenta ante una parada cardiaca: "
    "con DeaMap puedes encontrar y navegar hasta el DEA mas proximo "
    "de forma rapida y sencilla.\n\n"
    "FUNCIONES PRINCIPALES:\n\n"
    "Localizacion de desfibriladores:\n"
    "\u2022 Mapa interactivo con todos los DEA registrados\n"
    "\u2022 Busqueda por proximidad usando tu ubicacion GPS\n"
    "\u2022 Navegacion integrada hasta el desfibrilador seleccionado\n"
    "\u2022 Informacion detallada de cada DEA: horario, accesibilidad, estado\n"
    "\u2022 Fotografias del DEA y su ubicacion exacta\n\n"
    "Comunidad y verificacion:\n"
    "\u2022 Registra nuevos desfibriladores que encuentres\n"
    "\u2022 Verifica y actualiza la informacion de DEAs existentes\n"
    "\u2022 Reporta incidencias (DEA faltante, averiado, reubicado)\n"
    "\u2022 Sistema de verificacion comunitaria para datos fiables\n\n"
    "Gestion para organizaciones:\n"
    "\u2022 Panel de administracion para gestionar flotas de DEAs\n"
    "\u2022 Control de estado, mantenimiento y caducidad de parches\n"
    "\u2022 Importacion masiva de DEAs via CSV\n"
    "\u2022 Asignacion de responsables y alertas de mantenimiento\n\n"
    "CARACTERISTICAS:\n"
    "\u2022 Interfaz sencilla pensada para situaciones de emergencia\n"
    "\u2022 Funciona con y sin conexion (cache de DEAs cercanos)\n"
    "\u2022 Datos verificados por la comunidad sanitaria\n"
    "\u2022 Actualizacion continua de la base de datos\n"
    "\u2022 Gratuita y sin publicidad\n"
    "\u2022 Respetuosa con tu privacidad: no recopilamos datos personales\n\n"
    "Desarrollada por Global Emergency.\n\n"
    "AVISO: Esta aplicacion es una herramienta de apoyo. "
    "Ante una emergencia, llama siempre al 112."
)

KEYWORDS_ES = "desfibrilador,DEA,AED,emergencia,parada cardiaca,RCP,primeros auxilios,mapa,localizador"

print("\n7. Filling Spanish version description...")
if VER_LOC_ES:
    result = api_call("PATCH", f"{BASE}/appStoreVersionLocalizations/{VER_LOC_ES}", {
        "data": {
            "type": "appStoreVersionLocalizations",
            "id": VER_LOC_ES,
            "attributes": {
                "description": DESCRIPTION_ES,
                "keywords": KEYWORDS_ES,
                "whatsNew": "Mejoras de rendimiento y estabilidad. Nuevas funciones de accesibilidad.",
                "supportUrl": "https://www.deamap.es/",
                "marketingUrl": "https://www.deamap.es/",
                "promotionalText": "Encuentra el desfibrilador mas cercano en segundos. Cada segundo cuenta."
            }
        }
    })
    if result: print("   OK")
else:
    print("   Creating es-ES version localization...")
    result = api_call("POST", f"{BASE}/appStoreVersionLocalizations", {
        "data": {
            "type": "appStoreVersionLocalizations",
            "attributes": {
                "locale": "es-ES",
                "description": DESCRIPTION_ES,
                "keywords": KEYWORDS_ES,
                "whatsNew": "Mejoras de rendimiento y estabilidad. Nuevas funciones de accesibilidad.",
                "supportUrl": "https://www.deamap.es/",
                "marketingUrl": "https://www.deamap.es/",
                "promotionalText": "Encuentra el desfibrilador mas cercano en segundos. Cada segundo cuenta."
            },
            "relationships": {
                "appStoreVersion": {"data": {"type": "appStoreVersions", "id": VERSION_ID}}
            }
        }
    })
    if result and "data" in result:
        VER_LOC_ES = result["data"]["id"]
        print(f"   OK — created {VER_LOC_ES}")


# ============================================================
# 5. English version description
# ============================================================

DESCRIPTION_EN = (
    "DeaMap helps you locate the nearest defibrillator (AED) "
    "in an emergency. Every second counts during cardiac arrest: "
    "with DeaMap you can quickly find and navigate to the closest AED.\n\n"
    "KEY FEATURES:\n\n"
    "AED Location:\n"
    "\u2022 Interactive map with all registered AEDs\n"
    "\u2022 Proximity search using your GPS location\n"
    "\u2022 Built-in navigation to the selected defibrillator\n"
    "\u2022 Detailed AED info: hours, accessibility, status\n"
    "\u2022 Photos of the AED and its exact location\n\n"
    "Community & Verification:\n"
    "\u2022 Register new defibrillators you find\n"
    "\u2022 Verify and update existing AED information\n"
    "\u2022 Report issues (missing, broken, relocated AEDs)\n"
    "\u2022 Community verification system for reliable data\n\n"
    "Organization Management:\n"
    "\u2022 Admin dashboard to manage AED fleets\n"
    "\u2022 Status tracking, maintenance and pad expiry control\n"
    "\u2022 Bulk AED import via CSV\n"
    "\u2022 Assign managers and maintenance alerts\n\n"
    "HIGHLIGHTS:\n"
    "\u2022 Simple interface designed for emergency situations\n"
    "\u2022 Works online and offline (nearby AED caching)\n"
    "\u2022 Data verified by the healthcare community\n"
    "\u2022 Continuously updated database\n"
    "\u2022 Free with no ads\n"
    "\u2022 Privacy-friendly: we do not collect personal data\n\n"
    "Developed by Global Emergency.\n\n"
    "DISCLAIMER: This app is a support tool. "
    "In an emergency, always call your local emergency number."
)

KEYWORDS_EN = "defibrillator,AED,emergency,cardiac arrest,CPR,first aid,map,locator,nearby,cardioprotection"

print("\n8. Adding/updating English version description...")
if VER_LOC_EN:
    result = api_call("PATCH", f"{BASE}/appStoreVersionLocalizations/{VER_LOC_EN}", {
        "data": {
            "type": "appStoreVersionLocalizations",
            "id": VER_LOC_EN,
            "attributes": {
                "description": DESCRIPTION_EN,
                "keywords": KEYWORDS_EN,
                "whatsNew": "Performance and stability improvements. New accessibility features.",
                "supportUrl": "https://www.deamap.es/",
                "marketingUrl": "https://www.deamap.es/",
                "promotionalText": "Find the nearest defibrillator in seconds. Every second counts."
            }
        }
    })
    if result: print("   OK")
else:
    result = api_call("POST", f"{BASE}/appStoreVersionLocalizations", {
        "data": {
            "type": "appStoreVersionLocalizations",
            "attributes": {
                "locale": "en-US",
                "description": DESCRIPTION_EN,
                "keywords": KEYWORDS_EN,
                "whatsNew": "Performance and stability improvements. New accessibility features.",
                "supportUrl": "https://www.deamap.es/",
                "marketingUrl": "https://www.deamap.es/",
                "promotionalText": "Find the nearest defibrillator in seconds. Every second counts."
            },
            "relationships": {
                "appStoreVersion": {"data": {"type": "appStoreVersions", "id": VERSION_ID}}
            }
        }
    })
    if result and "data" in result:
        VER_LOC_EN = result["data"]["id"]
        print(f"   OK — created {VER_LOC_EN}")


# ============================================================
# 6. English app info localization
# ============================================================

print("\n9. Adding/updating English app info...")
if INFO_LOC_EN:
    result = api_call("PATCH", f"{BASE}/appInfoLocalizations/{INFO_LOC_EN}", {
        "data": {
            "type": "appInfoLocalizations",
            "id": INFO_LOC_EN,
            "attributes": {
                "name": "DeaMap",
                "subtitle": "Nearby defibrillators",
                "privacyPolicyUrl": "https://www.deamap.es/privacy"
            }
        }
    })
    if result: print("   OK")
else:
    result = api_call("POST", f"{BASE}/appInfoLocalizations", {
        "data": {
            "type": "appInfoLocalizations",
            "attributes": {
                "locale": "en-US",
                "name": "DeaMap",
                "subtitle": "Nearby defibrillators",
                "privacyPolicyUrl": "https://www.deamap.es/privacy"
            },
            "relationships": {
                "appInfo": {"data": {"type": "appInfos", "id": APP_INFO_ID}}
            }
        }
    })
    if result: print("   OK")


# ============================================================
# Summary
# ============================================================

print("\n" + "=" * 60)
print("DONE! DeaMap App Store metadata configured.")
print("=" * 60)
print(f"\n  APP_ID:      {APP_ID}")
print(f"  APP_INFO_ID: {APP_INFO_ID}")
print(f"  VERSION_ID:  {VERSION_ID}")
print(f"  VER_LOC_ES:  {VER_LOC_ES}")
print(f"  VER_LOC_EN:  {VER_LOC_EN}")
print(f"  INFO_LOC_ES: {INFO_LOC_ES}")
print(f"  INFO_LOC_EN: {INFO_LOC_EN}")
print("\nPending:")
print("  - Screenshots (run generate_screenshots.py + upload_screenshots.py)")
print("  - Privacy policy page at deamap.es/privacy")
