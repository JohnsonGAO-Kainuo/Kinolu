"""Re-process sample.jpg: bottom crop (road visible) + light desaturation only."""
from PIL import Image, ImageEnhance
import os, sys

SRC = "/tmp/kinolu_road_src.jpg"
DST = os.path.join(os.path.dirname(__file__), "..", "public", "luts", "sample.jpg")

# Download if not cached
if not os.path.exists(SRC):
    import urllib.request
    url = "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=85"
    urllib.request.urlretrieve(url, SRC)
    print(f"Downloaded to {SRC}")

img = Image.open(SRC)
w, h = img.size
print(f"Source: {w}x{h}")

# Bottom-crop to square — captures the road + horizon
sq = min(w, h)
y_off = h - sq
cropped = img.crop((0, y_off, sq, h))
print(f"Cropped {sq}x{sq} from y={y_off}")

# LIGHT processing — keep colors so LUT differences are visible
sat = ImageEnhance.Color(cropped).enhance(0.80)   # 80% saturation
con = ImageEnhance.Contrast(sat).enhance(0.92)    # 92% contrast

# Resize
final = con.resize((200, 200), Image.LANCZOS)
final.save(DST, quality=82, optimize=True)

sz = os.path.getsize(DST)
print(f"Saved: {final.size}, {sz} bytes")

import numpy as np
arr = np.array(final)
print(f"Mean RGB: {arr.mean(axis=(0,1)).astype(int)}")
print(f"Std:  {arr.std(axis=(0,1)).astype(int)}")
print(f"Top (sky):     {arr[:40].mean(axis=(0,1)).astype(int)}")
print(f"Bottom (road): {arr[160:].mean(axis=(0,1)).astype(int)}")
os.remove(SRC)
print("Done!")
