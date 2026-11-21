"""Render desktop and tray icons from the existing Oblique vector mark."""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/assets/brand/app-mark-white.svg"
TARGET = ROOT / "src-tauri"

mark = Image.open(BytesIO(cairosvg.svg2png(url=str(SOURCE), output_width=1024, output_height=1024))).convert("RGBA")
mark = mark.crop(mark.getchannel("A").getbbox())
tray_mark = Image.open(BytesIO(cairosvg.svg2png(url=str(SOURCE), output_width=2048, output_height=2048))).convert("RGBA")
tray_mark = tray_mark.crop(tray_mark.getchannel("A").getbbox())


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
    mark_width = round(edge * 0.90)
    mark_height = round(mark.height * mark_width / mark.width)
    resized = mark.resize((mark_width, mark_height), Image.Resampling.LANCZOS)
    image.alpha_composite(resized, ((edge - mark_width) // 2, (edge - mark_height) // 2))
    if connected:
        dot = round(edge * 0.28)
        margin = round(edge * 0.035)
        x, y = edge - dot - margin, edge - dot - margin
        d = ImageDraw.Draw(image)
        d.ellipse((x - edge * 0.018, y - edge * 0.018, x + dot + edge * 0.018, y + dot + edge * 0.018), fill="#0b172b")
        d.ellipse((x, y, x + dot, y + dot), fill="#35d878")
    return image.resize((size, size), Image.Resampling.LANCZOS)


def tray_icon(size: int, connected: bool = False) -> Image.Image:
    edge = size * 8
    mark_width = round(edge * 0.96)
    mark_height = round(tray_mark.height * mark_width / tray_mark.width)
    resized = tray_mark.resize((mark_width, mark_height), Image.Resampling.LANCZOS)
    resized.putalpha(resized.getchannel("A").filter(ImageFilter.MaxFilter(11)))
    image = Image.new("RGBA", (edge, edge), (0, 0, 0, 0))
    image.alpha_composite(resized, ((edge - mark_width) // 2, (edge - mark_height) // 2))
    if connected:
        dot = round(edge * 0.30)
        margin = round(edge * 0.025)
        x, y = edge - dot - margin, edge - dot - margin
        draw = ImageDraw.Draw(image)
        draw.ellipse((x - edge * 0.02, y - edge * 0.02, x + dot + edge * 0.02, y + dot + edge * 0.02), fill=(0, 0, 0, 210))
        draw.ellipse((x, y, x + dot, y + dot), fill="#35d878")
    return image.resize((size, size), Image.Resampling.LANCZOS)


icon(1024).save(TARGET / "app-icon.png")
(TARGET / "icons").mkdir(exist_ok=True)
tray_icon(64).save(TARGET / "icons/tray-idle.png")
tray_icon(64, True).save(TARGET / "icons/tray-connected.png")
icon(64).save(ROOT / "public/favicon.png")
