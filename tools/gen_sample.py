"""
Generate a neutral color-rich sample image for LUT preview thumbnails.

This creates a 200x200 image with bands of typical photographic colors
(skin tones, sky, foliage, warm, cool, neutral gray) at medium saturation
and flat contrast — ideal for showing LUT differences clearly.
"""

from PIL import Image, ImageDraw, ImageFilter
import colorsys

W, H = 200, 200
img = Image.new("RGB", (W, H))
draw = ImageDraw.Draw(img)

# Color palette: pairs of (hue_degrees, sat, lightness)
# Each row is a horizontal band blending two related colors
bands = [
    # Sky: blue gradient
    ((210, 0.35, 0.70), (195, 0.30, 0.80)),
    # Foliage: green
    ((120, 0.30, 0.50), (90, 0.25, 0.55)),
    # Skin tone: warm peach
    ((25, 0.35, 0.72), (15, 0.40, 0.65)),
    # Warm: orange/golden
    ((35, 0.40, 0.60), (45, 0.35, 0.55)),
    # Neutral: gray ramp
    ((0, 0.0, 0.35), (0, 0.0, 0.75)),
    # Cool shadow: blue-purple
    ((240, 0.20, 0.40), (270, 0.15, 0.50)),
    # Sunset: pink-orange
    ((350, 0.30, 0.65), (20, 0.35, 0.70)),
    # Earth: brown-olive
    ((30, 0.25, 0.45), (60, 0.20, 0.50)),
]

band_h = H // len(bands)

for i, ((h1, s1, l1), (h2, s2, l2)) in enumerate(bands):
    y0 = i * band_h
    y1 = y0 + band_h
    for x in range(W):
        t = x / W
        h = (h1 + (h2 - h1) * t) / 360.0
        s = s1 + (s2 - s1) * t
        l = l1 + (l2 - l1) * t
        r, g, b = colorsys.hls_to_rgb(h, l, s)
        draw.point((x, y0), (int(r * 255), int(g * 255), int(b * 255)))
    # Fill band by repeating first row
    row = img.crop((0, y0, W, y0 + 1))
    for y in range(y0 + 1, y1):
        img.paste(row, (0, y))

# Slight Gaussian blur to make it look natural, not banded
img = img.filter(ImageFilter.GaussianBlur(radius=3))

out = "public/luts/sample.jpg"
img.save(out, "JPEG", quality=92)
print(f"✓ Generated {out} ({W}x{H})")
