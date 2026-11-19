# Builds Screensaver.zip (pack files only) for upload or a release.
import os, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(ROOT, 'Screensaver.zip')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in ['manifest.json', 'icon.png', 'banner.png', 'README.md', 'CREDITS.md']: z.write(os.path.join(ROOT, f), f)
    for d, _, files in os.walk(os.path.join(ROOT, 'screensaver')):
        for f in sorted(files):
            p = os.path.join(d, f); z.write(p, os.path.relpath(p, ROOT))
print(out, os.path.getsize(out) // 1024, 'KB')
