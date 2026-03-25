#!/usr/bin/env python3
"""
Generate App Store & Google Play screenshots for DeaMap.
Style: Gradient backgrounds + bold white text + subtitles + rounded phone mockup.

Output structure:
  screenshots/custom_pages/<page_name>/<lang>/
    apple/iPhones 6.9/       (1320x2868)
    apple/iPad 13/            (2064x2752)
    android/Phones 16-9/      (1080x1920)
    android/Tablets 16-9/     (1200x1920)

Prerequisites:
    pip install Pillow

Raw screenshots must be placed in screenshots/ directory.
Take them from the running app (simulator or device) at the highest resolution.

Usage:
    python scripts/store/generate_screenshots.py
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
SCREENSHOTS_DIR = os.path.join(PROJECT_DIR, "screenshots")
RAW = SCREENSHOTS_DIR
OUTPUT = os.path.join(SCREENSHOTS_DIR, "custom_pages")

FONT_BOLD = "arialbd.ttf"
FONT_REGULAR = "arial.ttf"

# Device specs: (width, height, phone_w_ratio, phone_h_ratio, corner_radius, is_landscape)
DEVICES = {
    "apple/iPhones 6.9":   (1320, 2868, 0.67, 0.66, 48, False),
    "apple/iPad 13":        (2064, 2752, 0.55, 0.62, 40, False),
    "android/Phones 16-9":  (1080, 1920, 0.70, 0.65, 36, False),
    "android/Tablets 16-9": (1200, 1920, 0.55, 0.62, 36, False),
}


def get_font(size, bold=True):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def draw_gradient(img, w, h, color_top, color_bottom):
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        t = t * t * (3 - 2 * t)  # smooth-step
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * t)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * t)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))


def draw_bubbles(img, w, h, color_top):
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    r0, g0, b0 = color_top
    c = (min(255, r0 + 40), min(255, g0 + 40), min(255, b0 + 40), 22)
    spots = [
        (0.08, 0.07, 0.12), (0.88, 0.12, 0.08), (0.15, 0.85, 0.07),
        (0.92, 0.05, 0.05), (0.04, 0.18, 0.04), (0.75, 0.25, 0.06),
    ]
    for px, py, pr in spots:
        cx, cy, rad = int(px * w), int(py * h), int(pr * w)
        draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=c)
    img.paste(Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB"), (0, 0))


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        test = f"{cur} {word}".strip()
        if draw.textbbox((0, 0), test, font=font)[2] <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def fit_text(draw, text, max_w, max_h, start_size=130):
    for size in range(start_size, 36, -4):
        font = get_font(size)
        lines = wrap_text(draw, text, font, max_w)
        asc, desc = font.getmetrics()
        lh = asc + desc + 14
        if len(lines) * lh <= max_h:
            return font, lines, lh
    font = get_font(40)
    return font, wrap_text(draw, text, font, max_w), 54


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [(0, 0), (size[0] - 1, size[1] - 1)], radius, fill=255
    )
    return mask


def create_screenshot(grad_top, grad_bot, title, subtitle, raw_path, out_path, device_key):
    W, H, pw_ratio, ph_ratio, p_radius, is_land = DEVICES[device_key]
    PHONE_W = int(W * pw_ratio)
    PHONE_H = int(H * ph_ratio)
    PHONE_X = (W - PHONE_W) // 2
    PHONE_Y = H - PHONE_H - int(H * 0.035)
    TEXT_Y = int(H * 0.02)
    TEXT_H = PHONE_Y - TEXT_Y - int(H * 0.015)

    scale = W / 1320.0
    title_start = int(130 * scale)
    sub_size = int(48 * scale)

    img = Image.new("RGB", (W, H), grad_top)
    draw_gradient(img, W, H, grad_top, grad_bot)
    draw_bubbles(img, W, H, grad_top)
    draw = ImageDraw.Draw(img)

    # Title
    max_tw = W - int(140 * scale)
    title_max = int(TEXT_H * 0.65) if subtitle else int(TEXT_H * 0.85)
    font, lines, lh = fit_text(draw, title, max_tw, title_max, title_start)
    total_th = len(lines) * lh

    if subtitle:
        sf = get_font(sub_size, bold=False)
        s_asc, s_desc = sf.getmetrics()
        sh = s_asc + s_desc
        combined = total_th + int(16 * scale) + sh
        y = TEXT_Y + (TEXT_H - combined) // 2
    else:
        y = TEXT_Y + (TEXT_H - total_th) // 2

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        x = (W - tw) // 2
        draw.text((x + 2, y + 3), line, fill=(0, 0, 0, 50), font=font)
        draw.text((x, y), line, fill="white", font=font)
        y += lh

    if subtitle:
        y += int(8 * scale)
        sf = get_font(sub_size, bold=False)
        bbox = draw.textbbox((0, 0), subtitle, font=sf)
        tw = bbox[2] - bbox[0]
        x = (W - tw) // 2
        draw.text((x, y), subtitle, fill=(255, 255, 255, 220), font=sf)

    # Phone mockup
    if os.path.exists(raw_path):
        phone_img = Image.open(raw_path).convert("RGBA")
        src_w, src_h = phone_img.size
        src_ratio = src_w / src_h
        dst_ratio = PHONE_W / PHONE_H
        if src_ratio > dst_ratio:
            new_h = PHONE_H
            new_w = int(PHONE_H * src_ratio)
        else:
            new_w = PHONE_W
            new_h = int(PHONE_W / src_ratio)
        phone_img = phone_img.resize((new_w, new_h), Image.LANCZOS)
        left = (new_w - PHONE_W) // 2
        top = 0
        phone_img = phone_img.crop((left, top, left + PHONE_W, top + PHONE_H))
        mask = rounded_mask((PHONE_W, PHONE_H), p_radius)

        phone_canvas = Image.new("RGBA", (PHONE_W, PHONE_H), (0, 0, 0, 0))
        phone_canvas.paste(phone_img, (0, 0), mask)

        # Shadow
        sp = int(25 * scale)
        shadow = Image.new("RGBA", (PHONE_W + sp * 2, PHONE_H + sp * 2), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            [(sp // 2, sp // 2), (PHONE_W + sp * 3 // 2, PHONE_H + sp * 3 // 2)],
            p_radius + 6, fill=(0, 0, 0, 60)
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(int(12 * scale)))

        # Border glow
        border = Image.new("RGBA", (PHONE_W + 6, PHONE_H + 6), (0, 0, 0, 0))
        ImageDraw.Draw(border).rounded_rectangle(
            [(0, 0), (PHONE_W + 5, PHONE_H + 5)], p_radius + 3, fill=(255, 255, 255, 35)
        )

        img_rgba = img.convert("RGBA")
        img_rgba.paste(shadow, (PHONE_X - sp, PHONE_Y - sp // 2), shadow)
        img_rgba.paste(border, (PHONE_X - 3, PHONE_Y - 3), border)
        img_rgba.paste(phone_canvas, (PHONE_X, PHONE_Y), phone_canvas)
        img = img_rgba.convert("RGB")

    img.save(out_path, "PNG", optimize=True)


# ============================================================
# Colors (gradient top, gradient bottom)
# ============================================================
C_GREEN   = ((39, 140, 70),  (20, 90, 45))     # DeaMap brand green
C_RED     = ((220, 50, 50),  (160, 30, 30))     # Emergency red
C_BLUE    = ((40, 130, 240), (20, 75, 170))     # Trust blue
C_ORANGE  = ((240, 150, 30), (200, 90, 10))     # Warm orange
C_TEAL    = ((0, 160, 140),  (0, 100, 95))      # Medical teal
C_DARK    = ((30, 55, 100),  (15, 25, 55))      # Dark professional
C_CORAL   = ((240, 100, 75), (185, 55, 35))     # Alert coral
C_PURPLE  = ((120, 70, 190), (75, 35, 130))     # Community purple

# Raw screenshots — captured from the running app
S = {
    "map":       os.path.join(RAW, "01_map.png"),         # Main map view zoomed with AED markers
    "nearby":    os.path.join(RAW, "02_nearby.png"),       # Nearby AEDs list with distances
    "detail":    os.path.join(RAW, "03_detail.png"),       # AED detail with photos and info
    "navigate":  os.path.join(RAW, "04_navigate.png"),     # Detail scrolled: access points, schedule
    "quickview": os.path.join(RAW, "05_register.png"),     # Map + bottom sheet quick detail
}

# ============================================================
# Page definitions
# (colors, title_es, subtitle_es, title_en, subtitle_en, raw_key)
# ============================================================
PAGES = {
    "default": [
        (C_GREEN,  "Encuentra el DEA mas cercano",     "Cada segundo cuenta",
                   "Find the nearest AED",              "Every second counts",              "map"),
        (C_BLUE,   "DEAs cerca de ti",                 "Distancia y disponibilidad en tiempo real",
                   "AEDs near you",                     "Distance & availability in real time", "nearby"),
        (C_ORANGE, "Informacion detallada",            "Fotos, horario y accesibilidad",
                   "Detailed information",              "Photos, hours & accessibility",     "detail"),
        (C_TEAL,   "Puntos de acceso",                 "Instrucciones paso a paso",
                   "Access points",                     "Step-by-step directions",           "navigate"),
        (C_RED,    "Encuentra y navega",               "Toca un DEA para llegar rapido",
                   "Find & navigate",                   "Tap an AED to get there fast",      "quickview"),
    ],
}


def generate_all():
    total = 0
    missing_raw = set()

    for page_name, screenshots in PAGES.items():
        for lang in ["es-ES", "en-US"]:
            for device_key in DEVICES:
                page_dir = os.path.join(OUTPUT, page_name, lang, device_key)
                os.makedirs(page_dir, exist_ok=True)

                for i, (colors, t_es, sub_es, t_en, sub_en, raw_key) in enumerate(screenshots):
                    title = t_es if lang == "es-ES" else t_en
                    subtitle = sub_es if lang == "es-ES" else sub_en
                    out_path = os.path.join(page_dir, f"{i+1:02d}.png")
                    raw_path = S.get(raw_key, "")

                    if raw_path and not os.path.exists(raw_path):
                        missing_raw.add(raw_path)

                    create_screenshot(
                        colors[0], colors[1], title, subtitle,
                        raw_path, out_path, device_key
                    )
                    total += 1

            print(f"  {page_name}/{lang}: {len(screenshots)} x {len(DEVICES)} devices")

    print(f"\nTotal: {total} screenshots generated in {OUTPUT}")

    if missing_raw:
        print(f"\nWARNING: {len(missing_raw)} raw screenshots not found (text-only screenshots generated):")
        for p in sorted(missing_raw):
            print(f"  - {p}")
        print("\nTo get full screenshots, capture these from the running app:")
        for key, path in sorted(S.items()):
            print(f"  {key}: {os.path.basename(path)}")


if __name__ == "__main__":
    generate_all()
