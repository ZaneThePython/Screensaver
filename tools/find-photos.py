# Lists landscape-oriented Wikimedia Commons featured pictures that are public domain or CC0.
import json, sys, urllib.parse, urllib.request
UA = {'User-Agent': 'JiboScreensaverBuilder/1.0 (zane@jiborevival.com)'}
CATS = sys.argv[1:] or ['Featured_pictures_of_landscapes']
def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(dict(params, format='json'))
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
out = []
for cat in CATS:
    cont = {}
    while True:
        r = api(dict(action='query', generator='categorymembers', gcmtitle='Category:' + cat, gcmtype='file', gcmlimit=200,
                     prop='imageinfo', iiprop='url|size|extmetadata', iiurlwidth=1920, **cont))
        for p in r.get('query', {}).get('pages', {}).values():
            ii = (p.get('imageinfo') or [{}])[0]; m = ii.get('extmetadata', {})
            lic = m.get('LicenseShortName', {}).get('value', '')
            w, h = ii.get('width', 0), ii.get('height', 0)
            if not (lic.lower().startswith('public domain') or lic.upper().startswith('CC0') or lic == 'PD'): continue
            if not h or not (1.3 <= w / h <= 2.4) or w < 1920: continue
            out.append({'title': p['title'], 'cat': cat, 'license': lic, 'w': w, 'h': h, 'thumb': ii.get('thumburl'),
                        'page': ii.get('descriptionurl'), 'artist': m.get('Artist', {}).get('value', ''),
                        'desc': m.get('ImageDescription', {}).get('value', '')[:200]})
        if 'continue' not in r: break
        cont = r['continue']
json.dump(out, open('candidates.json', 'w'), indent=1)
for c in out: print(c['cat'][:30], '|', c['license'], '|', c['w'], 'x', c['h'], '|', c['title'][:90])
print(len(out))
