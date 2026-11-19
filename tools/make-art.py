# Renders Screensaver store art: banner.png (1000x800) and icon.png (330x330).
# Banner: a real photo from the pack, dimmed, with the clock in a corner and a glowing title.
# Icon: white picture-frame glyph (mountains + moon) with a small clock badge, on transparent.
import os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = '/root/.hermes/fonts/Nunito.ttf'
BLUE = (127, 168, 255)
S = 2

def font(size, weight):
    f = ImageFont.truetype(FONT, size * S); f.set_variation_by_name(weight); return f

def glow(base, layer, radius, strength=2):
    blur = layer.filter(ImageFilter.GaussianBlur(radius * S))
    for _ in range(strength): base.alpha_composite(blur)
    base.alpha_composite(layer)

# ---- banner ----
W, H = 1000 * S, 800 * S
banner = Image.new('RGBA', (W, H), (14, 16, 24, 255))
photo = Image.open(os.path.join(ROOT, 'screensaver/resources/photos/09.jpg')).convert('RGB')
fw, fh = 840 * S, int(840 * S * 9 / 16)
photo = ImageEnhance.Brightness(photo.resize((fw, fh), Image.LANCZOS)).enhance(0.8).convert('RGBA')
fx, fy = (W - fw) // 2, 70 * S
mask = Image.new('L', (fw, fh), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, fw - 1, fh - 1], radius=22 * S, fill=255)
frame = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(frame).rounded_rectangle([fx - 4 * S, fy - 4 * S, fx + fw + 4 * S, fy + fh + 4 * S], radius=26 * S, fill=BLUE + (120,))
glow(banner, frame, 18)
banner.paste(photo, (fx, fy), mask)
# clock in the photo's bottom-left corner, like on the robot
shade = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(shade)
sd.ellipse([fx - 300 * S, fy + fh - 200 * S, fx + 340 * S, fy + fh + 200 * S], fill=(0, 0, 0, 120))
shade = shade.filter(ImageFilter.GaussianBlur(50 * S)); clipped = Image.new('RGBA', (W, H), (0, 0, 0, 0))
clipped.paste(shade.crop((fx, fy, fx + fw, fy + fh)), (fx, fy), mask); banner.alpha_composite(clipped)
txt = Image.new('RGBA', (W, H), (0, 0, 0, 0)); t = ImageDraw.Draw(txt)
t.text((fx + 34 * S, fy + fh - 150 * S), '7:42', font=font(84, 'Light'), fill=(255, 255, 255, 255))
t.text((fx + 38 * S, fy + fh - 52 * S), 'Tuesday, November 17', font=font(24, 'Regular'), fill=(240, 240, 240, 255))
banner.alpha_composite(txt)
title = Image.new('RGBA', (W, H), (0, 0, 0, 0)); tt = ImageDraw.Draw(title)
tt.text((W // 2, 670 * S), 'Screensaver', font=font(120, 'Black'), fill=BLUE + (255,), anchor='mm')
glow(banner, title, 12, 1)
banner.convert('RGB').resize((1000, 800), Image.LANCZOS).save(os.path.join(ROOT, 'banner.png'))

# ---- icon ----
S2 = 4; W = 330 * S2
icon = Image.new('LA', (W, W), (0, 0)); d = ImageDraw.Draw(icon)
lw = 13 * S2
x0, y0, x1, y1 = 62 * S2, 82 * S2, 268 * S2, 236 * S2
d.rounded_rectangle([x0, y0, x1, y1], radius=20 * S2, outline=(255, 255), width=lw)
d.ellipse([200 * S2, 108 * S2, 230 * S2, 138 * S2], fill=(255, 255))                      # moon
d.polygon([(x0 + lw, y1 - lw), (128 * S2, 150 * S2), (172 * S2, 196 * S2), (198 * S2, 170 * S2), (x1 - lw, y1 - lw)], fill=(255, 255))  # mountains
# clock badge over the bottom-right corner, with a transparent ring around it
cx, cy, r = 250 * S2, 230 * S2, 46 * S2
d.ellipse([cx - r - 10 * S2, cy - r - 10 * S2, cx + r + 10 * S2, cy + r + 10 * S2], fill=(0, 0))
d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255), width=11 * S2)
d.line([(cx, cy), (cx, cy - 27 * S2)], fill=(255, 255), width=10 * S2)
d.line([(cx, cy), (cx + 20 * S2, cy + 8 * S2)], fill=(255, 255), width=10 * S2)
small = icon.resize((330, 330), Image.LANCZOS); box = small.getbbox(); glyph = small.crop(box)
k = 200 / max(glyph.size); glyph = glyph.resize((round(glyph.width * k), round(glyph.height * k)), Image.LANCZOS)
out = Image.new('LA', (330, 330), (0, 0)); out.paste(glyph, ((330 - glyph.width) // 2, (330 - glyph.height) // 2))
out.save(os.path.join(ROOT, 'icon.png'))
# preview on the menu button colour
prev = Image.new('RGBA', (330, 330), (0, 0, 0, 255)); pd = ImageDraw.Draw(prev); pd.ellipse([0, 0, 329, 329], fill=BLUE + (255,))
ic = Image.open(os.path.join(ROOT, 'icon.png')).convert('RGBA'); prev.alpha_composite(ic)
prev.save(sys.argv[1] if len(sys.argv) > 1 else '/root/.hermes/cache/scratch/ss/icon-preview.png')
print('wrote banner.png and icon.png')
