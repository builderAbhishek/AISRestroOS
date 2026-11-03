from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

res_dir = Path("apps/desktop/resources")
res_dir.mkdir(parents=True, exist_ok=True)

size = (256, 256)
img = Image.new("RGBA", size, (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Rounded rectangle background with Bhagwa orange (#F07818)
bg_color = (240, 120, 24, 255)
border_color = (200, 90, 10, 255)

# Outer rounded rectangle
draw.rounded_rectangle([(8, 8), (248, 248)], radius=52, fill=bg_color, outline=border_color, width=4)

# Inner soft gradient / accent
draw.rounded_rectangle([(24, 24), (232, 232)], radius=40, fill=(245, 135, 45, 255))

# Draw Stylized Restaurant Cloche / Dome & POS Plate
# Base Plate
draw.rounded_rectangle([(48, 172), (208, 188)], radius=8, fill=(255, 255, 255, 255))
draw.rectangle([(64, 188), (192, 198)], fill=(255, 230, 200, 255))

# Cloche Dome
draw.chord([(60, 80), (196, 172)], start=180, end=0, fill=(255, 255, 255, 255))

# Cloche Handle / Knob
draw.ellipse([(116, 64), (140, 88)], fill=(255, 255, 255, 255))

# "AIS" Monogram / Brand mark
try:
    font = ImageFont.truetype("arialbd.ttf", 36)
except Exception:
    font = ImageFont.load_default()

text = "AIS"
bbox = draw.textbbox((0, 0), text, font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
tx = (256 - tw) // 2
ty = 118

draw.text((tx, ty), text, font=font, fill=(240, 120, 24, 255))

# Save PNG
png_path = res_dir / "icon.png"
img.save(png_path, "PNG")

# Save ICO with multi-resolution icon sizes
ico_path = res_dir / "icon.ico"
img.save(
    ico_path,
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

print(f"Generated icon assets:\n  PNG: {png_path}\n  ICO: {ico_path}")
