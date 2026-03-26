#!/usr/bin/env python3
"""
Create Custom Product Pages in App Store Connect for DeaMap.
Each page targets a specific audience with tailored screenshots and promo text.

Usage:
    python scripts/store/create_custom_product_pages.py
"""
import jwt, time, json, urllib.request, urllib.error, ssl, os, sys, hashlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
SCREENSHOTS_DIR = os.path.join(PROJECT_DIR, "screenshots", "custom_pages")

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
APP_ID = "6760004634"

DISPLAY_TYPES = {
    "iPhones 6.9": "APP_IPHONE_67",
    "iPad 13": "APP_IPAD_PRO_3GEN_129",
}

AUDIENCES = {
    "municipios": {
        "name": "Municipios y Administracion Publica",
        "promo_es": "Gestiona la red de desfibriladores de tu municipio. Cumplimiento normativo, verificacion y mapa publico para tus ciudadanos.",
        "promo_en": "Manage your city AED network. Compliance, verification, and a public map for your citizens.",
    },
    "mantenimiento": {
        "name": "Empresas de Mantenimiento DEA",
        "promo_es": "Panel de control para tu flota de desfibriladores. Alertas de caducidad, historial de mantenimiento y auditoria.",
        "promo_en": "Fleet dashboard for your AEDs. Expiry alerts, maintenance logs, and audit trails across all clients.",
    },
    "proteccion-civil": {
        "name": "Proteccion Civil",
        "promo_es": "Localiza el DEA mas cercano al instante. Verifica su estado en patrullas y registra DEAs temporales en eventos.",
        "promo_en": "Locate the nearest AED instantly. Verify status on patrols and register temporary AEDs at events.",
    },
    "deportes": {
        "name": "Centros Deportivos",
        "promo_es": "Tu centro deportivo necesita un DEA accesible. Cumple la normativa, controla el mantenimiento y protege a tus deportistas.",
        "promo_en": "Your sports center needs an accessible AED. Stay compliant, track maintenance, protect your athletes.",
    },
    "farmacias": {
        "name": "Farmacias",
        "promo_es": "Convierte tu farmacia en punto de cardioproteccion. Registra tu DEA y se referencia para tu comunidad.",
        "promo_en": "Turn your pharmacy into a cardiac protection point. Register your AED, become a community reference.",
    },
}


def api(method, url, data=None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    })
    try:
        resp = urllib.request.urlopen(req, context=ctx)
        content = resp.read()
        return json.loads(content) if content else {"ok": True}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print("    ERR %d: %s" % (e.code, err[:400]))
        return None


def upload_screenshot(set_id, filepath):
    filename = os.path.basename(filepath)
    filesize = os.path.getsize(filepath)
    with open(filepath, "rb") as f:
        filebytes = f.read()
    checksum = hashlib.md5(filebytes).hexdigest()

    reserve = api("POST", BASE + "/appScreenshots", {
        "data": {
            "type": "appScreenshots",
            "attributes": {"fileName": filename, "fileSize": filesize},
            "relationships": {
                "appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}
            }
        }
    })
    if not reserve:
        return False

    ss_id = reserve["data"]["id"]
    for op in reserve["data"]["attributes"].get("uploadOperations", []):
        chunk = filebytes[op["offset"]:op["offset"] + op["length"]]
        headers = {h["name"]: h["value"] for h in op["requestHeaders"]}
        req = urllib.request.Request(op["url"], data=chunk, method=op["method"], headers=headers)
        urllib.request.urlopen(req, context=ctx)

    api("PATCH", BASE + "/appScreenshots/" + ss_id, {
        "data": {"type": "appScreenshots", "id": ss_id,
                 "attributes": {"uploaded": True, "sourceFileChecksum": checksum}}
    })
    return True


print("=" * 60)
print("DeaMap - Custom Product Pages")
print("=" * 60)

# Delete test page if exists
print("\nCleaning up test pages...")
existing = api("GET", BASE + "/apps/" + APP_ID + "/appCustomProductPages?limit=50")
if existing and existing.get("data"):
    for p in existing["data"]:
        name = p["attributes"].get("name", "")
        if "test" in name.lower():
            api("DELETE", BASE + "/appCustomProductPages/" + p["id"])
            print("  Deleted test: " + name)

results = {}
for aud_id, aud in AUDIENCES.items():
    print("\n" + "=" * 50)
    print("  " + aud["name"])
    print("=" * 50)

    # Check if already exists
    page_id = None
    if existing and existing.get("data"):
        for p in existing["data"]:
            if p["attributes"].get("name") == aud["name"]:
                page_id = p["id"]
                print("  Already exists: " + page_id)
                break

    if not page_id:
        # Deep create: page + version + localizations
        result = api("POST", BASE + "/appCustomProductPages", {
            "data": {
                "type": "appCustomProductPages",
                "attributes": {"name": aud["name"]},
                "relationships": {
                    "app": {"data": {"type": "apps", "id": APP_ID}},
                    "appCustomProductPageVersions": {
                        "data": [{"type": "appCustomProductPageVersions", "id": "${cpv}"}]
                    }
                }
            },
            "included": [
                {
                    "type": "appCustomProductPageVersions",
                    "id": "${cpv}",
                    "relationships": {
                        "appCustomProductPageLocalizations": {
                            "data": [
                                {"type": "appCustomProductPageLocalizations", "id": "${loc-es}"},
                                {"type": "appCustomProductPageLocalizations", "id": "${loc-en}"},
                            ]
                        }
                    }
                },
                {"type": "appCustomProductPageLocalizations", "id": "${loc-es}",
                 "attributes": {"locale": "es-ES", "promotionalText": aud["promo_es"]}},
                {"type": "appCustomProductPageLocalizations", "id": "${loc-en}",
                 "attributes": {"locale": "en-US", "promotionalText": aud["promo_en"]}},
            ]
        })

        if not result:
            print("  FAILED")
            continue

        page_id = result["data"]["id"]
        page_url = result["data"]["attributes"]["url"]
        print("  Created: " + page_id)
        print("  URL: " + page_url)
        results[aud_id] = {"id": page_id, "url": page_url}
    else:
        url_resp = api("GET", BASE + "/appCustomProductPages/" + page_id)
        if url_resp:
            page_url = url_resp["data"]["attributes"].get("url", "N/A")
            results[aud_id] = {"id": page_id, "url": page_url}

    # Get version + localizations
    versions = api("GET", BASE + "/appCustomProductPages/" + page_id + "/appCustomProductPageVersions?limit=5")
    if not versions or not versions.get("data"):
        continue
    cpv_id = versions["data"][0]["id"]

    locs = api("GET", BASE + "/appCustomProductPageVersions/" + cpv_id + "/appCustomProductPageLocalizations")
    loc_map = {}
    if locs and locs.get("data"):
        for loc in locs["data"]:
            loc_map[loc["attributes"]["locale"]] = loc["id"]

    # Upload screenshots per locale + device
    for lang, loc_id in loc_map.items():
        for device_folder, display_type in DISPLAY_TYPES.items():
            shot_dir = os.path.join(SCREENSHOTS_DIR, aud_id, lang, "apple", device_folder)
            if not os.path.isdir(shot_dir):
                continue

            # Get existing screenshot sets
            sets_resp = api("GET", BASE + "/appCustomProductPageLocalizations/" + loc_id + "/appScreenshotSets")
            set_id = None
            if sets_resp and sets_resp.get("data"):
                for s in sets_resp["data"]:
                    if s["attributes"]["screenshotDisplayType"] == display_type:
                        set_id = s["id"]
                        # Delete existing screenshots
                        old_ss = api("GET", BASE + "/appScreenshotSets/" + set_id + "/appScreenshots?limit=10")
                        if old_ss and old_ss.get("data"):
                            for ss in old_ss["data"]:
                                api("DELETE", BASE + "/appScreenshots/" + ss["id"])
                        break

            if not set_id:
                set_result = api("POST", BASE + "/appScreenshotSets", {
                    "data": {
                        "type": "appScreenshotSets",
                        "attributes": {"screenshotDisplayType": display_type},
                        "relationships": {
                            "appCustomProductPageLocalization": {
                                "data": {"type": "appCustomProductPageLocalizations", "id": loc_id}
                            }
                        }
                    }
                })
                if not set_result:
                    continue
                set_id = set_result["data"]["id"]

            files = sorted([f for f in os.listdir(shot_dir) if f.endswith(".png")])
            for fname in files:
                ok = upload_screenshot(set_id, os.path.join(shot_dir, fname))
                print("    [%s] %s/%s: %s" % (lang, device_folder, fname, "OK" if ok else "FAIL"))

print("\n" + "=" * 60)
print("CUSTOM PRODUCT PAGES COMPLETE!")
print("=" * 60)
for aud_id, info in results.items():
    print("  %s: %s" % (aud_id, info["url"]))
