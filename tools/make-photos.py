# Builds screensaver/resources/photos/*.jpg (1440x810, cover-cropped) and CREDITS.md
# from the public-domain / CC0 Wikimedia Commons featured pictures picked in tools/photos.json.
import json, os, re, html, urllib.request, io
from PIL import Image
UA = {'User-Agent': 'JiboScreensaverBuilder/1.0 (zane@jiborevival.com)'}
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'screensaver/resources/photos'); W, H = 1440, 810
photos = json.load(open(os.path.join(HERE, 'photos.json')))
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
credits = ['# Photo credits', '', 'Every photo is a Wikimedia Commons featured picture released into the public domain or under CC0. Thank you to the photographers.', '']
for i, p in enumerate(photos):
    im = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(p['thumb'], headers=UA), timeout=120).read())).convert('RGB')
    s = max(W / im.width, H / im.height); im = im.resize((round(im.width * s + 0.5), round(im.height * s + 0.5)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    name = '%02d.jpg' % i
    im.crop((l, t, l + W, t + H)).save(os.path.join(OUT, name), quality=84, optimize=True, progressive=False)
    artist = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', p['artist']))).strip() or 'unknown'
    credits.append('- %s: [%s](%s), by %s, %s' % (name, p['title'][5:].rsplit('.', 1)[0], p['page'], artist, p['license']))
open(os.path.join(ROOT, 'CREDITS.md'), 'w').write('\n'.join(credits) + '\n')
print(len(photos), 'photos,', sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024, 'KB')
