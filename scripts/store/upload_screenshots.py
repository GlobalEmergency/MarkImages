#!/usr/bin/env python3
"""
Upload screenshots to App Store Connect for DeaMap.

Discovers localization IDs dynamically (no hardcoded UUIDs).

Usage:
    python scripts/store/upload_screenshots.py --default          # Default listing
    python scripts/store/upload_screenshots.py --delete-existing   # Delete old + re-upload
"""
import jwt, time, json, urllib.request, urllib.error, ssl, os, sys, hashlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
SCREENSHOTS_DIR = os.path.join(PROJECT_DIR, "screenshots", "custom_pages")

# --- Auth ---
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

# --- Display type mapping ---
DISPLAY_TYPES = {
    "iPhones 6.9": "APP_IPHONE_67",
    "iPad 13": "APP_IPAD_PRO_3GEN_129",
}


# --- API helpers ---

def api(method, url, data=None):
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


def upload_binary(url, headers_list, data):
    req = urllib.request.Request(url, data=data, method="PUT")
    for h in headers_list:
        req.add_header(h["name"], h["value"])
    try:
        urllib.request.urlopen(req, context=ctx)
        return True
    except urllib.error.HTTPError as e:
        print(f"  UPLOAD ERROR {e.code}: {e.read().decode()[:300]}")
        return False


def md5_checksum(filepath):
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


# --- Discover IDs ---

def discover_version_id():
    """Find the latest editable App Store version."""
    # Try editable states first
    for states in [
        "PREPARE_FOR_SUBMISSION,WAITING_FOR_REVIEW,IN_REVIEW,DEVELOPER_REJECTED",
        "READY_FOR_SALE",
        ""
    ]:
        url = f"{BASE}/apps/{APP_ID}/appStoreVersions"
        if states:
            url += f"?filter[appStoreState]={states}"
        result = api("GET", url)
        if result and "data" in result and result["data"]:
            v = result["data"][0]
            print(f"  Version: {v['attributes']['versionString']} ({v['attributes']['appStoreState']})")
            return v["id"]
    return None


def discover_version_localizations(version_id):
    """Get localization IDs for a version."""
    result = api("GET", f"{BASE}/appStoreVersions/{version_id}/appStoreVersionLocalizations")
    locs = {}
    if result and "data" in result:
        for loc in result["data"]:
            locale = loc["attributes"]["locale"]
            locs[locale] = loc["id"]
    return locs


# --- Screenshot operations ---

def get_screenshot_sets(localization_id, loc_type="appStoreVersionLocalizations"):
    url = f"{BASE}/{loc_type}/{localization_id}/appScreenshotSets"
    result = api("GET", url)
    if result and "data" in result:
        return result["data"]
    return []


def get_screenshots_in_set(set_id):
    url = f"{BASE}/appScreenshotSets/{set_id}/appScreenshots"
    result = api("GET", url)
    if result and "data" in result:
        return result["data"]
    return []


def delete_screenshot(screenshot_id):
    return api("DELETE", f"{BASE}/appScreenshots/{screenshot_id}")


def create_screenshot_set(localization_id, display_type, loc_type="appStoreVersionLocalizations"):
    result = api("POST", f"{BASE}/appScreenshotSets", {
        "data": {
            "type": "appScreenshotSets",
            "attributes": {"screenshotDisplayType": display_type},
            "relationships": {
                loc_type.rstrip("s"): {
                    "data": {"type": loc_type, "id": localization_id}
                }
            }
        }
    })
    if result and "data" in result:
        return result["data"]["id"]
    return None


def get_or_create_set(localization_id, display_type, loc_type="appStoreVersionLocalizations"):
    sets = get_screenshot_sets(localization_id, loc_type)
    for s in sets:
        if s["attributes"]["screenshotDisplayType"] == display_type:
            return s["id"]
    return create_screenshot_set(localization_id, display_type, loc_type)


def upload_screenshot(set_id, filepath):
    filename = os.path.basename(filepath)
    filesize = os.path.getsize(filepath)
    checksum = md5_checksum(filepath)

    # 1. Reserve
    reserve = api("POST", f"{BASE}/appScreenshots", {
        "data": {
            "type": "appScreenshots",
            "attributes": {"fileName": filename, "fileSize": filesize},
            "relationships": {
                "appScreenshotSet": {
                    "data": {"type": "appScreenshotSets", "id": set_id}
                }
            }
        }
    })
    if not reserve or "data" not in reserve:
        return False

    ss_id = reserve["data"]["id"]
    upload_ops = reserve["data"]["attributes"].get("uploadOperations", [])

    # 2. Upload chunks
    with open(filepath, "rb") as f:
        file_data = f.read()
    for op in upload_ops:
        chunk = file_data[op["offset"]:op["offset"] + op["length"]]
        if not upload_binary(op["url"], op["requestHeaders"], chunk):
            return False

    # 3. Commit
    commit = api("PATCH", f"{BASE}/appScreenshots/{ss_id}", {
        "data": {
            "type": "appScreenshots",
            "id": ss_id,
            "attributes": {"uploaded": True, "sourceFileChecksum": checksum}
        }
    })
    return commit is not None


def upload_screenshots_for_loc(localization_id, page_name, lang, device_folder, display_type,
                                loc_type="appStoreVersionLocalizations", delete_existing=False):
    print(f"\n  [{page_name}] {lang} / {device_folder}")

    set_id = get_or_create_set(localization_id, display_type, loc_type)
    if not set_id:
        print(f"    FAILED to get/create screenshot set")
        return 0

    if delete_existing:
        existing = get_screenshots_in_set(set_id)
        if existing:
            print(f"    Deleting {len(existing)} existing screenshots...")
            for ss in existing:
                delete_screenshot(ss["id"])
            time.sleep(1)

    screenshot_dir = os.path.join(SCREENSHOTS_DIR, page_name, lang, "apple", device_folder)
    if not os.path.isdir(screenshot_dir):
        print(f"    Directory not found: {screenshot_dir}")
        return 0

    count = 0
    for i in range(1, 11):  # up to 10 screenshots
        filepath = os.path.join(screenshot_dir, f"{i:02d}.png")
        if not os.path.exists(filepath):
            break
        print(f"    Uploading {i:02d}.png...", end=" ", flush=True)
        if upload_screenshot(set_id, filepath):
            print("OK")
            count += 1
        else:
            print("FAILED")
    return count


# --- Main ---

def upload_default_listing(delete_existing=False):
    print("=" * 60)
    print("DISCOVERING IDs...")
    print("=" * 60)

    version_id = discover_version_id()
    if not version_id:
        print("FATAL: No editable version found")
        sys.exit(1)

    locs = discover_version_localizations(version_id)
    print(f"  Localizations found: {list(locs.keys())}")

    print("\n" + "=" * 60)
    print("UPLOADING DEFAULT LISTING SCREENSHOTS")
    print("=" * 60)

    total = 0
    for lang in ["es-ES", "en-US"]:
        loc_id = locs.get(lang)
        if not loc_id:
            print(f"\n  WARNING: No localization for {lang}, skipping")
            continue
        for device_folder, display_type in DISPLAY_TYPES.items():
            count = upload_screenshots_for_loc(
                loc_id, "default", lang, device_folder, display_type,
                delete_existing=delete_existing
            )
            total += count

    expected = len(["es-ES", "en-US"]) * len(DISPLAY_TYPES) * 5
    print(f"\nDefault listing: {total}/{expected} screenshots uploaded")
    return total


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print("Usage:")
        print("  python scripts/store/upload_screenshots.py --default")
        print("  python scripts/store/upload_screenshots.py --default --delete-existing")
        sys.exit(1)

    delete = "--delete-existing" in args

    if "--default" in args:
        upload_default_listing(delete_existing=delete)

    print("\nDone!")
