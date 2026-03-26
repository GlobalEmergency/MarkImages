#!/usr/bin/env python3
"""
Generate screenshots for Custom Product Pages / Custom Store Listings.
5 audiences x 2 languages x 4 device targets x 5 screenshots = 200 images.
"""
from PIL import Image, ImageDraw, ImageFont
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
SCREENSHOTS_DIR = os.path.join(PROJECT_DIR, "screenshots", "custom_pages")

RAW_SHOTS = [
    os.path.join(PROJECT_DIR, "screenshots", f)
    for f in ["01_map.png", "02_nearby.png", "03_detail.png", "04_navigate.png", "05_register.png"]
]

AUDIENCES = {
    "municipios": {
        "es-ES": [
            ("Gestiona la red de\nDEAs de tu municipio", "Cumplimiento normativo en tiempo real"),
            ("Mapa completo de\ndesfibriladores", "Visibilidad para tus ciudadanos"),
            ("Verificacion de estado\nde cada DEA", "Historial de mantenimiento"),
            ("Navegacion al DEA\nmas cercano", "Protege a tus vecinos"),
            ("Registro sencillo\nde nuevos DEAs", "Alta en minutos sin papeleos"),
        ],
        "en-US": [
            ("Manage your city's\nAED network", "Real-time compliance tracking"),
            ("Complete map of\nall defibrillators", "Visibility for your citizens"),
            ("Verify each\nAED's status", "Maintenance history log"),
            ("Navigate to the\nnearest AED", "Protect your community"),
            ("Easy registration\nof new AEDs", "Set up in minutes"),
        ],
    },
    "mantenimiento": {
        "es-ES": [
            ("Panel de control\npara tu flota de DEAs", "Gestion centralizada de todos tus clientes"),
            ("DEAs cerca de ti\ny de tus clientes", "Localiza cualquier desfibrilador"),
            ("Alertas de caducidad\nde electrodos y bateria", "Nunca pierdas una revision"),
            ("Registro de cada\nintervencion", "Auditoria completa para tus clientes"),
            ("Anade DEAs de\nnuevos clientes", "Onboarding rapido y sencillo"),
        ],
        "en-US": [
            ("Fleet dashboard\nfor all your AEDs", "Centralized management across clients"),
            ("AEDs near you\nand your clients", "Locate any defibrillator"),
            ("Electrode & battery\nexpiry alerts", "Never miss a service visit"),
            ("Log every\nmaintenance visit", "Complete audit trail for clients"),
            ("Add new client\nAEDs instantly", "Fast onboarding no hassle"),
        ],
    },
    "proteccion-civil": {
        "es-ES": [
            ("Localiza el DEA\nmas cercano al instante", "Responde mas rapido en emergencias"),
            ("DEAs verificados\ncerca de ti", "Informacion fiable en tiempo real"),
            ("Verifica el estado\nen tus patrullas", "Manten los DEAs de tu zona al dia"),
            ("Navega al DEA\nmas proximo", "Cada segundo cuenta"),
            ("Registra DEAs\nen eventos", "Cobertura temporal bajo control"),
        ],
        "en-US": [
            ("Locate the nearest\nAED instantly", "Respond faster in emergencies"),
            ("Verified AEDs\nnear you", "Reliable real-time information"),
            ("Verify status\non your patrols", "Keep your area's AEDs updated"),
            ("Navigate to the\nclosest AED", "Every second counts"),
            ("Register AEDs\nat events", "Temporary coverage under control"),
        ],
    },
    "deportes": {
        "es-ES": [
            ("Tu centro deportivo\ntiene DEA?", "Cumple la normativa con DeaMap"),
            ("DEAs cerca de tu\ninstalacion", "Protege a tus deportistas"),
            ("Control de caducidad\ny mantenimiento", "Tu DEA siempre listo para actuar"),
            ("Navegacion instantanea\nal DEA mas cercano", "Cada segundo cuenta"),
            ("Registra tu DEA\nen el mapa", "Espacio cardioprotegido visible"),
        ],
        "en-US": [
            ("Does your sports\ncenter have an AED?", "Stay compliant with DeaMap"),
            ("AEDs near your\nfacility", "Protect your athletes"),
            ("Expiry and\nmaintenance control", "Your AED always ready to act"),
            ("Instant navigation\nto nearest AED", "Every second counts"),
            ("Register your AED\non the map", "Show you are cardioprotected"),
        ],
    },
    "farmacias": {
        "es-ES": [
            ("Tu farmacia puede\nsalvar vidas", "Punto de cardioproteccion comunitario"),
            ("DEAs cerca de\ntu farmacia", "Referencia para tu comunidad"),
            ("Manten tu DEA\nsiempre operativo", "Alertas de caducidad automaticas"),
            ("Guia a quien lo\nnecesita hasta tu DEA", "Navegacion directa en emergencias"),
            ("Registra el DEA\nde tu farmacia", "Visible para tu barrio en minutos"),
        ],
        "en-US": [
            ("Your pharmacy\ncan save lives", "Community cardiac protection point"),
            ("AEDs near\nyour pharmacy", "A reference for your community"),
            ("Keep your AED\nalways operational", "Automatic expiry alerts"),
            ("Guide people to\nyour AED", "Direct navigation in emergencies"),
            ("Register your\npharmacy's AED", "Visible to your neighborhood"),
        ],
    },
}

TARGETS = {
    "apple/iPhones 6.9": (1320, 2868),
    "apple/iPad 13": (2064, 2752),
    "android/Phones 16-9": (1080, 1920),
    "android/Tablets 16-9": (1920, 1080),
}

GREEN = (46, 125, 50)
WHITE = (255, 255, 255)
LIGHT_GREEN = (200, 230, 200)


def get_font(size):
    for fp in [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, size)
    return ImageFont.load_default()


def create_screenshot(raw_path, headline, subtitle, tw, th):
    canvas = Image.new("RGB", (tw, th), GREEN)
    draw = ImageDraw.Draw(canvas)
    is_landscape = tw > th

    raw = Image.open(raw_path).convert("RGB")
    rw, rh = raw.size

    if is_landscape:
        text_w = int(tw * 0.45)
        max_h = int(th * 0.85)
        max_w = int((tw - text_w) * 0.85)
        scale = min(max_w / rw, max_h / rh)
        nw, nh = int(rw * scale), int(rh * scale)
        resized = raw.resize((nw, nh), Image.LANCZOS)
        canvas.paste(resized, (text_w + ((tw - text_w) - nw) // 2, (th - nh) // 2))

        fsz = int(th * 0.055)
        ssz = int(th * 0.035)
        font = get_font(fsz)
        sfont = get_font(ssz)
        hbox = draw.textbbox((0, 0), headline, font=font)
        sbox = draw.textbbox((0, 0), subtitle, font=sfont)
        hh = hbox[3] - hbox[1]
        sh = sbox[3] - sbox[1]
        y0 = (th - hh - 30 - sh) // 2
        draw.text((40, y0), headline, fill=WHITE, font=font)
        draw.text((40, y0 + hh + 30), subtitle, fill=LIGHT_GREEN, font=sfont)
    else:
        text_h = int(th * 0.28)
        max_h = int((th - text_h) * 0.92)
        max_w = int(tw * 0.88)
        scale = min(max_w / rw, max_h / rh)
        nw, nh = int(rw * scale), int(rh * scale)
        resized = raw.resize((nw, nh), Image.LANCZOS)
        canvas.paste(resized, ((tw - nw) // 2, text_h + ((th - text_h) - nh) // 2))

        fsz = int(tw * 0.075)
        ssz = int(tw * 0.042)
        font = get_font(fsz)
        sfont = get_font(ssz)

        # Center headline
        lines = headline.split("\n")
        line_heights = []
        for line in lines:
            bb = draw.textbbox((0, 0), line, font=font)
            line_heights.append(bb[3] - bb[1])
        total_hh = sum(line_heights) + (len(lines) - 1) * 5

        y = int(text_h * 0.1)
        for i, line in enumerate(lines):
            bb = draw.textbbox((0, 0), line, font=font)
            lw = bb[2] - bb[0]
            draw.text(((tw - lw) // 2, y), line, fill=WHITE, font=font)
            y += line_heights[i] + 5

        y += 10
        sbb = draw.textbbox((0, 0), subtitle, font=sfont)
        sw = sbb[2] - sbb[0]
        draw.text(((tw - sw) // 2, y), subtitle, fill=LIGHT_GREEN, font=sfont)

    return canvas


total = 0
for aud_id, aud_data in AUDIENCES.items():
    for lang, headlines in aud_data.items():
        for target_name, (tw, th) in TARGETS.items():
            out_dir = os.path.join(SCREENSHOTS_DIR, aud_id, lang, target_name)
            os.makedirs(out_dir, exist_ok=True)
            for i, (headline, subtitle) in enumerate(headlines):
                img = create_screenshot(RAW_SHOTS[i], headline, subtitle, tw, th)
                img.save(os.path.join(out_dir, f"{i+1:02d}.png"), "PNG", optimize=True)
                total += 1
    print(f"  {aud_id}: done")

print(f"\nTotal: {total} screenshots generated")
