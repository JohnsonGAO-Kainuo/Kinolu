"""Regenerate all PWA icons from the Figma logo image."""
from PIL import Image, ImageDraw
import os

# Load the actual Figma logo
logo = Image.open('/tmp/figma_logo_check.png').convert('RGBA')
print(f"Figma logo: {logo.size}")


def make_icon(logo_img, size, padding_pct=0, bg_color=(0, 0, 0, 0)):
    """Create an icon at the given size with the logo centered."""
    canvas = Image.new('RGBA', (size, size), bg_color)
    padding = int(size * padding_pct)
    area = size - 2 * padding
    lw, lh = logo_img.size
    scale = min(area / lw, area / lh)
    new_w = int(lw * scale)
    new_h = int(lh * scale)
    resized = logo_img.resize((new_w, new_h), Image.LANCZOS)
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas


# 1. icon-192.png — transparent background
icon_192 = make_icon(logo, 192, padding_pct=0.05)
icon_192.save('public/icon-192.png')
print(f"icon-192.png saved ({os.path.getsize('public/icon-192.png')} bytes)")

# 2. icon-512.png — transparent background
icon_512 = make_icon(logo, 512, padding_pct=0.05)
icon_512.save('public/icon-512.png')
print(f"icon-512.png saved ({os.path.getsize('public/icon-512.png')} bytes)")

# 3. icon-512-maskable.png — solid black background, 20% padding for safe zone
icon_mask = make_icon(logo, 512, padding_pct=0.20, bg_color=(0, 0, 0, 255))
icon_mask.save('public/icon-512-maskable.png')
print(f"icon-512-maskable.png saved ({os.path.getsize('public/icon-512-maskable.png')} bytes)")

# 4. logo-icon.png — 128px, for auth pages
logo_icon = make_icon(logo, 128, padding_pct=0.05)
logo_icon.save('public/logo-icon.png')
print(f"logo-icon.png saved ({os.path.getsize('public/logo-icon.png')} bytes)")

# 5. logo-icon-sm.png — 48px, for sidebar/top bar
logo_sm = make_icon(logo, 48, padding_pct=0.02)
logo_sm.save('public/logo-icon-sm.png')
print(f"logo-icon-sm.png saved ({os.path.getsize('public/logo-icon-sm.png')} bytes)")

# 6. favicon.ico — multi-resolution
fav_16 = make_icon(logo, 16)
fav_32 = make_icon(logo, 32)
fav_48 = make_icon(logo, 48)
fav_16.save('src/app/favicon.ico', format='ICO',
            sizes=[(16, 16), (32, 32), (48, 48)],
            append_images=[fav_32, fav_48])
print(f"favicon.ico saved ({os.path.getsize('src/app/favicon.ico')} bytes)")

print("\nAll icons regenerated from Figma logo!")
