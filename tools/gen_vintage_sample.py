"""Process vintage street photo as sample.jpg for LUT previews."""
from PIL import Image, ImageEnhance
import numpy as np
import os
import urllib.request

SRC = "/tmp/vintage_havana.jpg"
DST = os.path.join(os.path.dirname(__file__), "..", "public", "luts", "sample.jpg")

# Download if needed
if not os.path.exists(SRC):
    url = "https://images.unsplash.com/photo-1585076641399-5c06d1b3365f?w=800&q=85"
    urllib.request.urlretrieve(url, SRC)
    print(f"Downloaded to {SRC}")

img = Image.open(SRC)
w, h = img.size
print(f"Source: {w}x{h}")

# Center crop to square
sq = min(w, h)
x_off = (w - sq) // 2
y_off = (h - sq) // 2
cropped = img.crop((x_off, y_off, x_off + sq, y_off + sq))
print(f"Cropped: {cropped.size}")

# Very light processing — keep rich colors for LUT differentiation
sat = ImageEnhance.Color(cropped).enhance(0.88)
con = ImageEnhance.Contrast(sat).enhance(0.95)
bri = ImageEnhance.Brightness(con).enhance(1.02)

final = bri.resize((200, 200), Image.LANCZOS)
final.save(DST, quality=82, optimize=True)

arr = np.array(final)
sz = os.path.getsize(DST)
print(f"Output: {final.size}, {sz} bytes")
print(f"Mean RGB: {arr.mean(axis=(0,1)).astype(int)}")
print(f"Std RGB:  {arr.std(axis=(0,1)).astype(int)}")
print(f"Min: {arr.min()}, Max: {arr.max()}")

# Cleanup
try:
    os.remove(SRC)
except:
    pass
for f in ["/tmp/vintage_test2.jpg", "/tmp/vintage_test3.jpg"]:
    try:
        os.remove(f)
    except:
        pass
print("Done!")
