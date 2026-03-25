#!/usr/bin/env python3
"""
Upload screenshots and feature graphic to Google Play for DeaMap.

Usage:
    python scripts/store/upload_google_play_screenshots.py
"""
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
SCREENSHOTS_DIR = os.path.join(PROJECT_DIR, "screenshots", "custom_pages")
PACKAGE = "es.deamap.mobile"

SA_KEY = os.path.join(PROJECT_DIR, "mobile", "keystores", "deamap-play-deploy.json")
if not os.path.exists(SA_KEY):
    SA_KEY = os.path.expanduser("~/Downloads/Dev/globalemergency-5b9204e4f0dd.json")

print(f"Using service account: {SA_KEY}")

credentials = service_account.Credentials.from_service_account_file(
    SA_KEY, scopes=["https://www.googleapis.com/auth/androidpublisher"]
)
service = build("androidpublisher", "v3", credentials=credentials)

# Google Play image types
# phoneScreenshots, sevenInchScreenshots, tenInchScreenshots, featureGraphic
LANG_DEVICE_MAP = {
    "es-ES": {
        "android/Phones 16-9": "phoneScreenshots",
        "android/Tablets 16-9": "tenInchScreenshots",
    },
    "en-US": {
        "android/Phones 16-9": "phoneScreenshots",
        "android/Tablets 16-9": "tenInchScreenshots",
    },
}

print("=" * 60)
print("DeaMap — Google Play Screenshots Upload")
print("=" * 60)

# Create edit
print("\n1. Creating edit...")
edit = service.edits().insert(body={}, packageName=PACKAGE).execute()
edit_id = edit["id"]
print(f"   Edit ID: {edit_id}")

total = 0

for lang, devices in LANG_DEVICE_MAP.items():
    for device_folder, image_type in devices.items():
        screenshot_dir = os.path.join(SCREENSHOTS_DIR, "default", lang, device_folder)
        if not os.path.isdir(screenshot_dir):
            print(f"\n  [{lang}] {device_folder}: directory not found, skipping")
            continue

        print(f"\n  [{lang}] {device_folder} -> {image_type}")

        # Delete existing screenshots first
        try:
            service.edits().images().deleteall(
                packageName=PACKAGE, editId=edit_id,
                language=lang, imageType=image_type
            ).execute()
            print(f"    Cleared existing {image_type}")
        except Exception:
            pass  # No existing screenshots

        # Upload new screenshots
        for i in range(1, 9):  # up to 8 screenshots per type
            filepath = os.path.join(screenshot_dir, f"{i:02d}.png")
            if not os.path.exists(filepath):
                break
            print(f"    Uploading {i:02d}.png...", end=" ", flush=True)
            try:
                media = MediaFileUpload(filepath, mimetype="image/png")
                service.edits().images().upload(
                    packageName=PACKAGE, editId=edit_id,
                    language=lang, imageType=image_type,
                    media_body=media
                ).execute()
                print("OK")
                total += 1
            except Exception as e:
                print(f"FAILED: {e}")

# Upload feature graphic if exists
feature_path = os.path.join(PROJECT_DIR, "screenshots", "feature_graphic.png")
if os.path.exists(feature_path):
    for lang in ["es-ES", "en-US"]:
        print(f"\n  Uploading feature graphic ({lang})...", end=" ", flush=True)
        try:
            service.edits().images().deleteall(
                packageName=PACKAGE, editId=edit_id,
                language=lang, imageType="featureGraphic"
            ).execute()
        except Exception:
            pass
        try:
            media = MediaFileUpload(feature_path, mimetype="image/png")
            service.edits().images().upload(
                packageName=PACKAGE, editId=edit_id,
                language=lang, imageType="featureGraphic",
                media_body=media
            ).execute()
            print("OK")
            total += 1
        except Exception as e:
            print(f"FAILED: {e}")

# Commit
print(f"\n2. Committing edit ({total} images uploaded)...")
try:
    service.edits().commit(packageName=PACKAGE, editId=edit_id).execute()
    print("   OK — All changes committed!")
except Exception as e:
    print(f"   ERROR: {e}")

print(f"\nTotal: {total} images uploaded to Google Play")
