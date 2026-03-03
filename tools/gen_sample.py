#!/usr/bin/env python3
"""Generate a vibrant sample image for LUT thumbnail differentiation."""
from PIL import Image
import numpy as np
from scipy.ndimage import gaussian_filter
from colorsys import rgb_to_hsv

w, h = 400, 400
img = np.zeros((h, w, 3), dtype=np.float32)

for y in range(int(h * 0.35)):
    t = y / (h * 0.35)
    img[y, :] = [90 + 50 * t, 150 + 50 * t, 220 - 20 * t]

for y in range(int(h * 0.35), int(h * 0.50)):
    t = (y - h * 0.35) / (h * 0.15)
    for x in range(w):
        noise = np.random.uniform(-12, 12)
        img[y, x] = [40 + 30 * t + noise, 100 + 50 * (1 - t) + noise, 30 + 20 * t + noise]

for y in range(int(h * 0.50), int(h * 0.70)):
    t = (y - h * 0.50) / (h * 0.20)
    img[y, :] = [170 + 30 * t, 130 + 10 * t, 90 - 10 * t]

for y in range(int(h * 0.70), h):
    t = (y - h * 0.70) / (h * 0.30)
    img[y, :] = [80 - 40 * t, 60 - 30 * t, 50 - 25 * t]

cx, cy, r = w // 2, int(h * 0.42), int(h * 0.12)
for y in range(max(0, cy - r), min(h, cy + r)):
    for x in range(max(0, cx - r), min(w, cx + r)):
        dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
        if dist < r:
            alpha = max(0, 1 - dist / r)
            skin = np.array([210.0, 170.0, 140.0])
            img[y, x] = img[y, x] * (1 - alpha) + skin * alpha

for y in range(int(h * 0.25), int(h * 0.45)):
    for x in range(int(w * 0.6), int(w * 0.85)):
        t = max(0, 1 - ((x - w * 0.72) ** 2 / (w * 0.12) ** 2 + (y - h * 0.35) ** 2 / (h * 0.08) ** 2) ** 0.5)
        if t > 0:
            img[y, x] = img[y, x] * (1 - t * 0.5) + np.array([255.0, 210.0, 140.0]) * t * 0.5

for y in range(int(h * 0.55), int(h * 0.75)):
    for x in range(int(w * 0.1), int(w * 0.35)):
        t = max(0, 1 - ((x - w * 0.22) ** 2 / (w * 0.12) ** 2 + (y - h * 0.65) ** 2 / (h * 0.08) ** 2) ** 0.5)
        if t > 0:
            img[y, x] = img[y, x] * (1 - t * 0.4) + np.array([80.0, 70.0, 130.0]) * t * 0.4

for y in range(int(h * 0.42), int(h * 0.52)):
    for x in range(int(w * 0.75), int(w * 0.90)):
        t = max(0, 1 - ((x - w * 0.82) ** 2 / (w * 0.06) ** 2 + (y - h * 0.47) ** 2 / (h * 0.04) ** 2) ** 0.5)
        if t > 0:
            img[y, x] = img[y, x] * (1 - t * 0.6) + np.array([220.0, 80.0, 60.0]) * t * 0.6

img = gaussian_filter(img, sigma=[3, 3, 0])
img = np.clip(img, 0, 255).astype(np.uint8)

Image.fromarray(img).save("public/luts/sample.jpg", quality=90)

sats = []
for row in img[::4]:
    for px in row[::4]:
        _, s, _ = rgb_to_hsv(px[0] / 255, px[1] / 255, px[2] / 255)
        sats.append(s)
sats = np.array(sats)
print(f"Mean sat: {sats.mean():.3f} (was 0.156), sat>0.3: {(sats > 0.3).mean() * 100:.1f}% (was 14%)")
print("Done")
