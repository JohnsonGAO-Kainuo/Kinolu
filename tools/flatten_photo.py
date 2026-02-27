"""
Flatten the user-provided desert road photo for LUT preview thumbnails.
Reduces saturation + contrast to create a neutral base that makes
each LUT's color character clearly visible.
"""
from PIL import Image, ImageEnhance
import sys, os

src = sys.argv[1] if len(sys.argv) > 1 else "public/luts/source_photo.jpg"
out = "public/luts/sample.jpg"

img = Image.open(src)

# Center-crop to square
w, h = img.size
s = min(w, h)
left = (w - s) // 2
top = (h - s) // 2
img = img.crop((left, top, left + s, top + s))

# Flatten: desaturate + reduce contrast to simulate flat/log profile
img = ImageEnhance.Color(img).enhance(0.45)       # saturation to 45%
img = ImageEnhance.Contrast(img).enhance(0.65)     # contrast to 65%
img = ImageEnhance.Brightness(img).enhance(1.08)   # lift shadows slightly

# Resize to 200x200
img = img.resize((200, 200), Image.LANCZOS)

img.save(out, "JPEG", quality=90)
print(f"✓ Generated flat-profile {out} ({img.size[0]}x{img.size[1]}, {os.path.getsize(out)} bytes)")
