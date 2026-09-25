"""בונה את לוגו "יתרה 0" כ-SVG עם אותיות כווקטורים (לא תלוי בפונט מותקן)."""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE

font = TTFont(os.path.join(HERE, 'rubik900.ttf'))
gs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font['head'].unitsPerEm
hmtx = font['hmtx']

FS = 100                     # גודל פונט בפיקסלים
s = FS / upm
word = 'יתרה'
visual = word[::-1]          # סדר ויזואלי משמאל לימין

# גבולות האותיות (ביחידות פונט) לצורך יישור האפס
ymin, ymax = 1e9, -1e9
for ch in visual:
    bp = BoundsPen(gs); gs[cmap[ord(ch)]].draw(bp)
    if bp.bounds:
        ymin = min(ymin, bp.bounds[1]); ymax = max(ymax, bp.bounds[3])
H = (ymax - ymin) * s        # גובה האותיות בפיקסלים

PAD = 12
BASE = PAD + ymax * s        # קו הבסיס (y) כך שראש האותיות נוגע ב-PAD

# ---------- האפס ----------
R = 0.36                     # עובי הקו ביחס לרדיוס (זהה לאייקון)
zh = H * 1.06                # גובה כולל של האפס (כולל עובי הקו)
ry = zh / (2 + R)
SW = R * ry
rx = ry * 0.64
zw = 2 * rx + SW
zx0 = PAD
cx = zx0 + zw / 2
cy = (BASE - ymax * s) + H / 2   # מרכז אנכי זהה למרכז האותיות

# הווי: נקודות יחסיות לגודל האפס (מבוסס על האייקון)
k = ry / 18.0
pts = [(-11.5, 1.5), (-4, 9), (14.5, -13)]
check = ' '.join(('M' if i == 0 else 'L') + f'{cx + x * k:.2f} {cy + y * k:.2f}' for i, (x, y) in enumerate(pts))
check_sw = 5 * k
cut_sw = 10.5 * k

GAP = FS * 0.24
x = zx0 + zw + GAP

paths = []
for ch in visual:
    gname = cmap[ord(ch)]
    pen = SVGPathPen(gs)
    tp = TransformPen(pen, (s, 0, 0, -s, x, BASE))
    gs[gname].draw(tp)
    paths.append(pen.getCommands())
    x += hmtx[gname][0] * s
W = x + PAD
Hh = BASE - ymin * s + PAD
text_d = ' '.join(paths)


def svg(text_color, check_color, gold=('#F9D27A', '#E9A92C'), idp='y0'):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {Hh:.1f}" role="img" aria-label="יתרה 0">
  <defs>
    <linearGradient id="{idp}-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{gold[0]}"/>
      <stop offset="1" stop-color="{gold[1]}"/>
    </linearGradient>
    <mask id="{idp}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="{W:.1f}" height="{Hh:.1f}">
      <rect width="{W:.1f}" height="{Hh:.1f}" fill="#fff"/>
      <path d="{check}" fill="none" stroke="#000" stroke-width="{cut_sw:.2f}" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>
  <ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="none" stroke="url(#{idp}-gold)" stroke-width="{SW:.2f}" mask="url(#{idp}-cut)"/>
  <path d="{check}" fill="none" stroke="{check_color}" stroke-width="{check_sw:.2f}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="{text_d}" fill="{text_color}"/>
</svg>
'''

open(os.path.join(OUT, 'logo-dark.svg'), 'w', encoding='utf-8').write(svg('#F8F4EA', '#F8F4EA', idp='y0d'))
open(os.path.join(OUT, 'logo-light.svg'), 'w', encoding='utf-8').write(svg('#0B2E24', '#0B2E24', gold=('#E9A92C', '#C98A12'), idp='y0l'))
print('size', round(W), round(Hh), 'letters H', round(H))
open(os.path.join(OUT, 'logo-mono.svg'), 'w', encoding='utf-8').write(svg('#0B2E24', '#0B2E24', gold=('#0B2E24', '#0B2E24'), idp='y0m'))
print('mono ok')


# ============================================================
# ייצוא PNG (Pillow) — אותה גאומטריה ואותו פונט כמו ה-SVG
# ============================================================
from PIL import Image, ImageDraw, ImageFont


def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def vgrad(w, h, c1, c2):
    """גרדיאנט אנכי"""
    a, b = hex2rgb(c1), hex2rgb(c2)
    g = Image.new('RGBA', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,))
    return g.resize((w, h))


def thick_line(d, pts, width, fill):
    """קו עבה עם קצוות וחיבורים מעוגלים: כל קטע כמצולע + עיגול בכל נקודה"""
    import math
    r = width / 2
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L * r, dx / L * r
        d.polygon([(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)], fill=fill)
    for (px, py) in pts:
        d.ellipse((px - r, py - r, px + r, py + r), fill=fill)


def draw_zero_and_check(img, S, ox, oy, zc, zr, sw, chk, chk_w, cut_w, gold, check_color):
    """zc=(cx,cy) zr=(rx,ry) בקואורדינטות לוגיות; S=קנה מידה; ox,oy=היסט"""
    W_, H_ = img.size
    cxp, cyp = ox + zc[0] * S, oy + zc[1] * S
    rxo, ryo = (zr[0] + sw / 2) * S, (zr[1] + sw / 2) * S
    rxi, ryi = (zr[0] - sw / 2) * S, (zr[1] - sw / 2) * S
    ring = Image.new('L', (W_, H_), 0)
    rd = ImageDraw.Draw(ring)
    rd.ellipse((cxp - rxo, cyp - ryo, cxp + rxo, cyp + ryo), fill=255)
    rd.ellipse((cxp - rxi, cyp - ryi, cxp + rxi, cyp + ryi), fill=0)
    pts = [(ox + x * S, oy + y * S) for (x, y) in chk]
    thick_line(rd, pts, cut_w * S, 0)                      # חיתוך
    top, bot = int(cyp - ryo), int(cyp + ryo)
    g = vgrad(W_, max(2, bot - top), gold[0], gold[1])
    layer = Image.new('RGBA', (W_, H_), (0, 0, 0, 0))
    layer.paste(g, (0, top))
    img.paste(layer, (0, 0), ring)
    d = ImageDraw.Draw(img)
    thick_line(d, pts, chk_w * S, hex2rgb(check_color) + (255,))


SS = 4  # סופר-סמפלינג לקצוות חלקים


def export_logo(name, width, text_color, check_color, gold, bg=None, pad_ratio=0.0):
    S = width / W * SS
    pad = int(width * pad_ratio * SS)
    img = Image.new('RGBA', (int(W * S) + 2 * pad, int(Hh * S) + 2 * pad), hex2rgb(bg) + (255,) if bg else (0, 0, 0, 0))
    chk_pts = [(cx + x * k, cy + y * k) for (x, y) in pts]
    draw_zero_and_check(img, S, pad, pad, (cx, cy), (rx, ry), SW, chk_pts, check_sw, cut_sw, gold, check_color)
    f = ImageFont.truetype(os.path.join(HERE, 'rubik900.ttf'), int(round(FS * S)))
    d = ImageDraw.Draw(img)
    d.text((pad + (zx0 + zw + GAP) * S, pad + BASE * S), visual, font=f, fill=hex2rgb(text_color) + (255,), anchor='ls')
    img = img.resize((img.width // SS, img.height // SS), Image.LANCZOS)
    img.save(os.path.join(OUT, name))
    print(name, img.size)


def export_mark(name, size):
    S = size / 64 * SS
    n = int(64 * S)
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    # רקע: ריבוע מעוגל עם גרדיאנט אלכסוני
    a, b = hex2rgb('#1F6A52'), hex2rgb('#0B2E24')
    bgimg = Image.new('RGBA', (n, n))
    px = bgimg.load()
    for yy in range(0, n):
        for xx in range(0, n, 1):
            t = (xx + yy) / (2 * n)
            px[xx, yy] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
    m = Image.new('L', (n, n), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, n - 1, n - 1), radius=int(16 * S), fill=255)
    img.paste(bgimg, (0, 0), m)
    chk = [(20.5, 33.5), (28, 41), (46.5, 19)]
    draw_zero_and_check(img, S, 0, 0, (32, 32), (11.5, 18), 6.5, chk, 5, 10.5, ('#F9D27A', '#E9A92C'), '#F8F4EA')
    img = img.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(OUT, name))
    print(name, img.size)


export_mark('mark-512.png', 512)
export_mark('mark-180.png', 180)      # apple-touch-icon
export_logo('logo-dark.png', 1200, '#F8F4EA', '#F8F4EA', ('#F9D27A', '#E9A92C'))
export_logo('logo-light.png', 1200, '#0B2E24', '#0B2E24', ('#E9A92C', '#C98A12'))
export_logo('logo-on-emerald.png', 1200, '#F8F4EA', '#F8F4EA', ('#F9D27A', '#E9A92C'), bg='#0B2E24', pad_ratio=0.12)
export_logo('logo-on-white.png', 1200, '#0B2E24', '#0B2E24', ('#E9A92C', '#C98A12'), bg='#FFFFFF', pad_ratio=0.12)
