#!/usr/bin/env python3
"""
Fill Google Play Store listing for DeaMap via API.

Usage:
    python scripts/store/fill_google_play_metadata.py
"""
import json, os
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
PACKAGE = "es.deamap.mobile"

# Service account key — deamap-play-deploy@globalemergency.iam.gserviceaccount.com
SA_KEY = os.path.join(PROJECT_DIR, "mobile", "keystores", "deamap-play-deploy.json")
if not os.path.exists(SA_KEY):
    SA_KEY = os.path.expanduser("~/Downloads/Dev/globalemergency-5b9204e4f0dd.json")

print(f"Using service account: {SA_KEY}")

credentials = service_account.Credentials.from_service_account_file(
    SA_KEY,
    scopes=["https://www.googleapis.com/auth/androidpublisher"]
)

service = build("androidpublisher", "v3", credentials=credentials)

print("=" * 60)
print("DeaMap — Google Play Store Metadata")
print("=" * 60)

# Create an edit
print("\n1. Creating edit...")
edit = service.edits().insert(body={}, packageName=PACKAGE).execute()
edit_id = edit["id"]
print(f"   Edit ID: {edit_id}")


# ============================================================
# Spanish listing (es-ES)
# ============================================================

print("\n2. Creating Spanish (es-ES) listing...")
desc_es = (
    "DeaMap te ayuda a localizar el desfibrilador (DEA) m\u00e1s cercano "
    "en caso de emergencia. Cada segundo cuenta ante una parada card\u00edaca: "
    "con DeaMap puedes encontrar y navegar hasta el DEA m\u00e1s pr\u00f3ximo "
    "de forma r\u00e1pida y sencilla.\n\n"

    "\u2764\ufe0f LOCALIZACI\u00d3N DE DESFIBRILADORES:\n"
    "\u2022 Mapa interactivo con todos los DEA registrados\n"
    "\u2022 B\u00fasqueda por proximidad usando tu ubicaci\u00f3n GPS\n"
    "\u2022 Navegaci\u00f3n integrada hasta el desfibrilador seleccionado\n"
    "\u2022 Informaci\u00f3n detallada: horario, accesibilidad, estado\n"
    "\u2022 Fotograf\u00edas del DEA y su ubicaci\u00f3n exacta\n\n"

    "\ud83d\udc65 COMUNIDAD Y VERIFICACI\u00d3N:\n"
    "\u2022 Registra nuevos desfibriladores que encuentres\n"
    "\u2022 Verifica y actualiza la informaci\u00f3n de DEAs existentes\n"
    "\u2022 Reporta incidencias (DEA faltante, averiado, reubicado)\n"
    "\u2022 Sistema de verificaci\u00f3n comunitaria para datos fiables\n\n"

    "\ud83c\udfe2 GESTI\u00d3N PARA ORGANIZACIONES:\n"
    "\u2022 Panel de administraci\u00f3n para gestionar flotas de DEAs\n"
    "\u2022 Control de estado, mantenimiento y caducidad de parches\n"
    "\u2022 Importaci\u00f3n masiva de DEAs v\u00eda CSV\n"
    "\u2022 Asignaci\u00f3n de responsables y alertas de mantenimiento\n\n"

    "\u2b50 CARACTER\u00cdSTICAS:\n"
    "\u2022 Interfaz sencilla pensada para situaciones de emergencia\n"
    "\u2022 Funciona con y sin conexi\u00f3n (cach\u00e9 de DEAs cercanos)\n"
    "\u2022 Datos verificados por la comunidad sanitaria\n"
    "\u2022 Actualizaci\u00f3n continua de la base de datos\n"
    "\u2022 Gratuita y sin publicidad\n"
    "\u2022 Respetuosa con tu privacidad: no recopilamos datos personales\n\n"

    "Desarrollada por Global Emergency.\n\n"
    "AVISO: Esta aplicaci\u00f3n es una herramienta de apoyo. "
    "Ante una emergencia, llama siempre al 112."
)

try:
    service.edits().listings().update(
        packageName=PACKAGE,
        editId=edit_id,
        language="es-ES",
        body={
            "language": "es-ES",
            "title": "DeaMap - Desfibriladores",
            "shortDescription": "Encuentra el desfibrilador m\u00e1s cercano en segundos. Cada segundo cuenta.",
            "fullDescription": desc_es,
        }
    ).execute()
    print("   OK")
except Exception as e:
    print(f"   ERROR: {e}")


# ============================================================
# English listing (en-US)
# ============================================================

print("\n3. Creating English (en-US) listing...")
desc_en = (
    "DeaMap helps you locate the nearest defibrillator (AED) "
    "in an emergency. Every second counts during cardiac arrest: "
    "with DeaMap you can quickly find and navigate to the closest AED.\n\n"

    "\u2764\ufe0f AED LOCATION:\n"
    "\u2022 Interactive map with all registered AEDs\n"
    "\u2022 Proximity search using your GPS location\n"
    "\u2022 Built-in navigation to the selected defibrillator\n"
    "\u2022 Detailed AED info: hours, accessibility, status\n"
    "\u2022 Photos of the AED and its exact location\n\n"

    "\ud83d\udc65 COMMUNITY & VERIFICATION:\n"
    "\u2022 Register new defibrillators you find\n"
    "\u2022 Verify and update existing AED information\n"
    "\u2022 Report issues (missing, broken, relocated AEDs)\n"
    "\u2022 Community verification system for reliable data\n\n"

    "\ud83c\udfe2 ORGANIZATION MANAGEMENT:\n"
    "\u2022 Admin dashboard to manage AED fleets\n"
    "\u2022 Status tracking, maintenance and pad expiry control\n"
    "\u2022 Bulk AED import via CSV\n"
    "\u2022 Assign managers and maintenance alerts\n\n"

    "\u2b50 HIGHLIGHTS:\n"
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

try:
    service.edits().listings().update(
        packageName=PACKAGE,
        editId=edit_id,
        language="en-US",
        body={
            "language": "en-US",
            "title": "DeaMap - Defibrillators",
            "shortDescription": "Find the nearest defibrillator in seconds. Every second counts.",
            "fullDescription": desc_en,
        }
    ).execute()
    print("   OK")
except Exception as e:
    print(f"   ERROR: {e}")


# ============================================================
# Contact details
# ============================================================

print("\n4. Setting contact details...")
try:
    service.edits().details().update(
        packageName=PACKAGE,
        editId=edit_id,
        body={
            "contactEmail": "info@globalemergency.online",
            "contactWebsite": "https://www.deamap.es/",
            "defaultLanguage": "es-ES",
        }
    ).execute()
    print("   OK")
except Exception as e:
    print(f"   ERROR: {e}")


# ============================================================
# Commit
# ============================================================

print("\n5. Committing edit...")
try:
    service.edits().commit(packageName=PACKAGE, editId=edit_id).execute()
    print("   OK — All changes committed!")
except Exception as e:
    print(f"   ERROR: {e}")

print("\n" + "=" * 60)
print("Google Play Store listing configured!")
print("=" * 60)
print("\nPending:")
print("  - Screenshots (run generate_screenshots.py + manual upload or API)")
print("  - Feature graphic (1024x500)")
print("  - Content rating questionnaire")
print("  - Privacy policy URL")
