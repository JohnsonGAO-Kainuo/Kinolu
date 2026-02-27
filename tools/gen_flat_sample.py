"""
Download and flatten a CC0 photo for LUT preview thumbnails.

Takes a colorful landscape photo and reduces saturation + contrast
to simulate a flat/neutral camera profile. This makes LUT differences
much more visible in the 96x96 preview thumbnails.
"""

from PIL import Image, ImageEnhance, ImageFilter
import urllib.request, io

# CC0 mountain landscape with sky, rocks, snow — good color variety
url = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop&auto=format&q=85"

print("Downloading source image...")
data = urllib.request.urlopen(url).read()
img = Image.open(io.BytesIO(data))

# Flatten: reduce saturation and contrast to simulate flat/log profile
img = ImageEnhance.Color(img).enhance(0.55)       # reduce saturation to 55%
img = ImageEnhance.Contrast(img).enhance(0.70)     # reduce contrast to 70%
img = ImageEnhance.Brightness(img).enhance(1.05)   # lift shadows slightly

# Resize to 200x200
img = img.resize((200, 200), Image.LANCZOS)

out = "public/luts/sample.jpg"
img.save(out, "JPEG", quality=88)
print(f"✓ Generated flat-profile {out} ({img.size[0]}x{img.size[1]})")

import os
print(f"  File size: {os.path.getsize(out)} bytes")
