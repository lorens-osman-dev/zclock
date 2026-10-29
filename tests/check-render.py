"""Inspect actual GJS/Cairo pixels, including transparency and smooth motion."""
import tempfile
from pathlib import Path
from PIL import Image, ImageChops

source = Path(tempfile.gettempdir()) / 'gclock-preview.png'
im = Image.open(source).convert('RGBA')
assert im.size == (640, 860)
assert im.getpixel((600, 100))[3] == 0, 'Wallpaper must stay transparent'
assert im.getpixel((200, 400))[3] == 0, 'Minute capsule must have NO fill'
assert any(im.getpixel((x, 430))[3] > 240 for x in range(30, 130)), 'Hour text is present'
# Interior points away from the digits should all remain completely empty.
# The dials are masked out here for readability, not painted over with a color.
assert all(im.getpixel((220, y))[3] == 0 for y in range(450, 465)), 'Dial bleeds through capsule'
# Drawing text directly can inherit desktop subpixel AA and cause green fringes
# on transparent surfaces. Neutral white strokes must stay neutral.
assert all(abs(r - g) <= 1 and abs(g - b) <= 1
           for x in range(20, 140) for y in range(375, 480)
           for r, g, b, a in [im.getpixel((x, y))] if a > 50), 'Colored text fringes'
background = Image.open(source.with_name('gclock-background.png')).convert('RGBA')
assert background.getpixel((200, 400)) == (51, 102, 153, 255), 'Renderer altered the backdrop behind minutes'
fractional = Image.open(source.with_name('gclock-fractional.png')).convert('RGBA')
# Ignore the minute capsule and hour; only compare the outer arc above them.
a = im.crop((0, 70, 365, 370))
b = fractional.crop((0, 70, 365, 370))
assert ImageChops.difference(a, b).getbbox() is not None, 'Dial did not move within one second'
# Produce a viewable illustration, but keep the actual test image transparent.
black = Image.new('RGBA', im.size, (0, 0, 0, 255))
black.alpha_composite(im)
black.convert('RGB').save(source.with_name('gclock-preview-black.png'))
print('Cairo pixel checks passed: transparent minutes, preserved backdrop, subsecond motion and neutral text')
