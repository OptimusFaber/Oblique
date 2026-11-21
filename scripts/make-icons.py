"""Render desktop and tray icons from the existing Oblique vector mark."""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/assets/brand/oblique-white.svg"
TARGET = ROOT / "src-tauri"

mark = Image.open(BytesIO(cairosvg.svg2png(url=str(SOURCE), output_width=1024, output_height=1024))).convert("RGBA")
mark = mark.crop(mark.getbbox())


def icon(size: int, connected: bool = False) -> Image.Image:
    scale = 4
    edge = size * scale
    image = Image.new("RGBA", (edge, edge))
    draw = ImageDraw.Draw(image)
    radius = round(edge * 0.21)
    for y in range(edge):
        t = y / max(edge - 1, 1)
        color = (round(11 + 7 * t), round(23 + 7 * t), round(43 + 9 * t), 255)
        draw.line((0, y, edge, y), fill=color)
    mask = Image.new("L", (edge, edge))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, edge - 1, edge - 1), radius=radius, fill=255)
    image.putalpha(mask)
    inset = round(edge * 0.12)
    glow = Image.new("RGBA", (edge, edge))
    ImageDraw.Draw(glow).ellipse((inset, inset, edge - inset, edge - inset), fill=(34, 174, 231, 38))
    glow = glow.filter(ImageFilter.GaussianBlur(edge * 0.1))
    image = Image.alpha_composite(image, glow)
    target_width = round(edge * 0.72)
    target_height = round(mark.height * target_width / mark.width)
    resized = mark.resize((target_width, target_height), Image.Resampling.LANCZOS)
    image.alpha_composite(resized, ((edge - target_width) // 2, (edge - target_height) // 2))
    if connected:
        dot = round(edge * 0.28)
        margin = round(edge * 0.035)
        x, y = edge - dot - margin, edge - dot - margin
        d = ImageDraw.Draw(image)
        d.ellipse((x - edge * 0.018, y - edge * 0.018, x + dot + edge * 0.018, y + dot + edge * 0.018), fill="#0b172b")
        d.ellipse((x, y, x + dot, y + dot), fill="#35d878")
    return image.resize((size, size), Image.Resampling.LANCZOS)


icon(1024).save(TARGET / "app-icon.png")
(TARGET / "icons").mkdir(exist_ok=True)
icon(32).save(TARGET / "icons/tray-idle.png")
icon(32, True).save(TARGET / "icons/tray-connected.png")
icon(64).save(ROOT / "public/favicon.png")
