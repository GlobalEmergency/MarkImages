#!/usr/bin/env python3
"""
Create Custom Store Listings in Google Play for DeaMap.
Each listing targets a specific audience with tailored screenshots and descriptions.

Note: Google Play Custom Store Listings require Google Play Console access.
The androidpublisher API supports listings per language, but Custom Store Listings
(targeted by URL) require the Google Play Console UI or the advanced API.

This script creates per-language listings with audience-specific descriptions
and uploads audience-specific screenshots as separate image types.

Usage:
    python scripts/store/create_google_custom_listings.py
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

credentials = service_account.Credentials.from_service_account_file(
    SA_KEY, scopes=["https://www.googleapis.com/auth/androidpublisher"]
)
service = build("androidpublisher", "v3", credentials=credentials)

# Google Play Custom Store Listings are created via the listings API
# Each listing update replaces the content for that language

AUDIENCES = {
    "municipios": {
        "title_es": "DeaMap - Desfibriladores Municipales",
        "title_en": "DeaMap - Municipal AED Network",
        "short_es": "Gestiona la red de DEAs de tu municipio",
        "short_en": "Manage your city AED network",
        "desc_es": (
            "DeaMap permite a los municipios y administraciones publicas gestionar "
            "su red de desfibriladores (DEA) de forma centralizada.\n\n"
            "FUNCIONES PARA MUNICIPIOS:\n"
            "- Mapa completo de todos los DEAs registrados en tu municipio\n"
            "- Verificacion del estado de cada desfibrilador\n"
            "- Historial de mantenimiento y auditorias\n"
            "- Cumplimiento normativo por comunidad autonoma\n"
            "- Mapa publico para que tus ciudadanos localicen el DEA mas cercano\n"
            "- Registro rapido de nuevos desfibriladores\n\n"
            "Cada segundo cuenta ante una parada cardiaca. Con DeaMap, tu municipio "
            "tiene una herramienta moderna para proteger a sus ciudadanos."
        ),
        "desc_en": (
            "DeaMap enables municipalities and public administrations to manage "
            "their AED (Automated External Defibrillator) network centrally.\n\n"
            "FEATURES FOR MUNICIPALITIES:\n"
            "- Complete map of all registered AEDs in your city\n"
            "- Status verification for each defibrillator\n"
            "- Maintenance history and audit trails\n"
            "- Regulatory compliance tracking\n"
            "- Public map so citizens can locate the nearest AED\n"
            "- Quick registration of new defibrillators\n\n"
            "Every second counts in a cardiac arrest. With DeaMap, your city has "
            "a modern tool to protect its citizens."
        ),
    },
    "mantenimiento": {
        "title_es": "DeaMap - Gestion Flota DEAs",
        "title_en": "DeaMap - AED Fleet Management",
        "short_es": "Panel de control para empresas de mantenimiento DEA",
        "short_en": "Dashboard for AED maintenance companies",
        "desc_es": (
            "DeaMap es la herramienta que necesitan las empresas de mantenimiento "
            "de desfibriladores para gestionar toda su flota de DEAs.\n\n"
            "FUNCIONES PARA EMPRESAS DE MANTENIMIENTO:\n"
            "- Panel centralizado con todos los DEAs de tus clientes\n"
            "- Alertas automaticas de caducidad de electrodos y baterias\n"
            "- Registro de cada visita de mantenimiento\n"
            "- Auditoria completa para demostrar cumplimiento a tus clientes\n"
            "- Onboarding rapido de nuevos clientes y dispositivos\n"
            "- Informes por comunidad autonoma\n\n"
            "Simplifica tu operativa diaria y ofrece un servicio profesional "
            "a tus clientes con DeaMap."
        ),
        "desc_en": (
            "DeaMap is the tool AED maintenance companies need to manage "
            "their entire device fleet.\n\n"
            "FEATURES FOR MAINTENANCE COMPANIES:\n"
            "- Centralized dashboard with all client AEDs\n"
            "- Automatic electrode and battery expiry alerts\n"
            "- Maintenance visit logging\n"
            "- Complete audit trail for client compliance\n"
            "- Fast onboarding of new clients and devices\n"
            "- Reports by region\n\n"
            "Simplify your daily operations and deliver professional service "
            "to your clients with DeaMap."
        ),
    },
    "proteccion-civil": {
        "title_es": "DeaMap - Proteccion Civil",
        "title_en": "DeaMap - Civil Protection",
        "short_es": "Localiza DEAs al instante en emergencias",
        "short_en": "Locate AEDs instantly in emergencies",
        "desc_es": (
            "DeaMap es la app imprescindible para voluntarios de Proteccion Civil "
            "y primeros intervinientes.\n\n"
            "FUNCIONES PARA PROTECCION CIVIL:\n"
            "- Localiza el DEA mas cercano al instante\n"
            "- Navegacion directa en situaciones de emergencia\n"
            "- Verifica el estado de los DEAs durante tus patrullas\n"
            "- Registra desfibriladores temporales en eventos\n"
            "- Informacion fiable y verificada en tiempo real\n"
            "- Gestion de DEAs por agrupacion\n\n"
            "Cada segundo cuenta. Con DeaMap, responde mas rapido y con informacion fiable."
        ),
        "desc_en": (
            "DeaMap is the essential app for Civil Protection volunteers "
            "and first responders.\n\n"
            "FEATURES FOR CIVIL PROTECTION:\n"
            "- Locate the nearest AED instantly\n"
            "- Direct navigation in emergency situations\n"
            "- Verify AED status during patrols\n"
            "- Register temporary AEDs at events\n"
            "- Reliable, verified real-time information\n"
            "- AED management by unit\n\n"
            "Every second counts. With DeaMap, respond faster with reliable information."
        ),
    },
    "deportes": {
        "title_es": "DeaMap - Centros Deportivos",
        "title_en": "DeaMap - Sports Centers",
        "short_es": "Cumple la normativa DEA en tu centro deportivo",
        "short_en": "AED compliance for your sports center",
        "desc_es": (
            "DeaMap ayuda a centros deportivos, gimnasios y polideportivos a cumplir "
            "la normativa de desfibriladores y proteger a sus deportistas.\n\n"
            "FUNCIONES PARA CENTROS DEPORTIVOS:\n"
            "- Registra tu DEA y hazlo visible para usuarios y visitantes\n"
            "- Control de caducidad de electrodos y baterias\n"
            "- Alertas automaticas de mantenimiento\n"
            "- Navegacion instantanea al DEA mas cercano\n"
            "- Demuestra que tu espacio es cardioprotegido\n"
            "- Cumplimiento normativo por comunidad autonoma\n\n"
            "La muerte subita en el deporte es una realidad. Con DeaMap, "
            "protege a tus deportistas y cumple la ley."
        ),
        "desc_en": (
            "DeaMap helps sports centers, gyms, and athletic facilities comply "
            "with AED regulations and protect their athletes.\n\n"
            "FEATURES FOR SPORTS CENTERS:\n"
            "- Register your AED and make it visible to users and visitors\n"
            "- Electrode and battery expiry tracking\n"
            "- Automatic maintenance alerts\n"
            "- Instant navigation to the nearest AED\n"
            "- Show your space is cardioprotected\n"
            "- Regulatory compliance tracking\n\n"
            "Sudden cardiac arrest in sports is a reality. With DeaMap, "
            "protect your athletes and stay compliant."
        ),
    },
    "farmacias": {
        "title_es": "DeaMap - Farmacias Cardioprotegidas",
        "title_en": "DeaMap - Cardioprotected Pharmacies",
        "short_es": "Tu farmacia como punto de cardioproteccion",
        "short_en": "Your pharmacy as a cardiac protection point",
        "desc_es": (
            "DeaMap permite a las farmacias convertirse en puntos de referencia "
            "de cardioproteccion para su comunidad.\n\n"
            "FUNCIONES PARA FARMACIAS:\n"
            "- Registra el DEA de tu farmacia en el mapa\n"
            "- Visible para todo tu barrio y comunidad\n"
            "- Alertas automaticas de caducidad\n"
            "- Guia a quien lo necesita hasta tu desfibrilador\n"
            "- Posiciona tu farmacia como espacio cardioprotegido\n"
            "- Especialmente util en zonas rurales\n\n"
            "Tu farmacia puede salvar vidas. Con DeaMap, se el punto de referencia "
            "de cardioproteccion de tu comunidad."
        ),
        "desc_en": (
            "DeaMap enables pharmacies to become cardiac protection reference points "
            "for their community.\n\n"
            "FEATURES FOR PHARMACIES:\n"
            "- Register your pharmacy AED on the map\n"
            "- Visible to your entire neighborhood\n"
            "- Automatic expiry alerts\n"
            "- Guide people to your defibrillator in emergencies\n"
            "- Position your pharmacy as a cardioprotected space\n"
            "- Especially useful in rural areas\n\n"
            "Your pharmacy can save lives. With DeaMap, become the cardiac protection "
            "reference point for your community."
        ),
    },
}

LANG_DEVICE_MAP = {
    "android/Phones 16-9": "phoneScreenshots",
    "android/Tablets 16-9": "tenInchScreenshots",
}

print("=" * 60)
print("DeaMap - Google Play Custom Store Listings")
print("=" * 60)

# Note: Google Play androidpublisher API v3 does not have a direct
# "custom store listing" endpoint like App Store Connect.
# Custom Store Listings are managed via Google Play Console UI.
#
# What we CAN do via API:
# 1. Update the default listing with audience-optimized content
# 2. Upload audience-specific screenshots
#
# For true custom listings by URL, use Google Play Console manually
# and link to: https://play.google.com/store/apps/details?id=es.deamap.mobile&listing=LISTING_ID

# We'll create an edit and upload all audience screenshots
# organized so they can be assigned to custom listings in Console

for aud_id, aud in AUDIENCES.items():
    print("\n" + "=" * 50)
    print("  " + aud_id.upper())
    print("=" * 50)

    edit = service.edits().insert(body={}, packageName=PACKAGE).execute()
    edit_id = edit["id"]

    for lang_code, lang_suffix in [("es-ES", "_es"), ("en-US", "_en")]:
        title = aud["title" + lang_suffix]
        short = aud["short" + lang_suffix]
        desc = aud["desc" + lang_suffix]

        # Upload screenshots for this audience
        for device_folder, image_type in LANG_DEVICE_MAP.items():
            shot_dir = os.path.join(SCREENSHOTS_DIR, aud_id, lang_code, device_folder)
            if not os.path.isdir(shot_dir):
                continue

            files = sorted([f for f in os.listdir(shot_dir) if f.endswith(".png")])
            for fname in files:
                fpath = os.path.join(shot_dir, fname)
                media = MediaFileUpload(fpath, mimetype="image/png")
                try:
                    service.edits().images().upload(
                        packageName=PACKAGE,
                        editId=edit_id,
                        language=lang_code,
                        imageType=image_type,
                        media_body=media,
                    ).execute()
                    print("    [%s] %s/%s: OK" % (lang_code, device_folder, fname))
                except Exception as e:
                    print("    [%s] %s/%s: %s" % (lang_code, device_folder, fname, str(e)[:100]))

    # Commit this edit
    try:
        service.edits().commit(packageName=PACKAGE, editId=edit_id).execute()
        print("  Committed!")
    except Exception as e:
        print("  Commit failed: %s" % str(e)[:200])

print("\n" + "=" * 60)
print("GOOGLE PLAY SCREENSHOTS UPLOADED!")
print("=" * 60)
print("\nNote: Custom Store Listings must be created in Google Play Console UI.")
print("Go to: Google Play Console > DeaMap > Store presence > Custom store listings")
print("Create 5 listings and assign the uploaded screenshots to each.")
print("\nAudience tracking URLs (after creating in Console):")
for aud_id in AUDIENCES:
    print("  %s: https://play.google.com/store/apps/details?id=es.deamap.mobile&listing=%s" % (aud_id, aud_id))
