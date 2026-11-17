"""
Bezešvá textura louky z fotky:  python3 textura-louky.py fotka.jpg x0 y0 x1 y1 natazeni vystup.webp
 - vyřízne pás trávy, srovná perspektivu (natažení do hloubky), odstraní velké stíny/přechody světla,
 - udělá z něj bezešvou dlaždici 1024 × 1024.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
try:
    from pillow_heif import register_heif_opener; register_heif_opener()
except ImportError:
    pass

f, x0, y0, x1, y1, nat, out = sys.argv[1], *map(int, sys.argv[2:6]), float(sys.argv[6]), sys.argv[7]
im = Image.open(f).convert('RGB').crop((x0, y0, x1, y1))
w, h = im.size
im = im.resize((w, int(h * nat)), Image.LANCZOS)               # perspektiva: pás země je zkrácený
s = min(im.size)
dl = []
for k in range(im.size[0] // s):                               # víc čtverců vedle sebe → průměr pro rovnoměrnost
    dl.append(np.asarray(im.crop((k * s, im.size[1] - s, (k + 1) * s, im.size[1])).resize((1024, 1024), Image.LANCZOS)).astype(np.float32))
a = dl[0] if len(dl) == 1 else np.concatenate([dl[0][:, :512], dl[-1][:, 512:]], axis=1)
# srovnat světlo: vydělit rozmazanou verzí (velké stíny, vinětace), zachovat průměrnou barvu
blur = np.asarray(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(90))).astype(np.float32) + 1
prumer = a.reshape(-1, 3).mean(0)
a = np.clip(a / blur * prumer, 0, 255)
# bezešvost: střed vlastní, okraje z posunuté kopie
yy, xx = np.mgrid[0:1024, 0:1024] / 1023.0
m = (np.sin(np.pi * xx) * np.sin(np.pi * yy)) ** 0.6
m = m[..., None]
r = np.roll(np.roll(a, 512, 0), 512, 1)
t = a * m + r * (1 - m)
Image.fromarray(t.astype(np.uint8)).save(out, quality=84)
print(out, Image.open(out).size, 'průměr', prumer.round())
