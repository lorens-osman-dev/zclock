"""Check real GJS/Cairo pixels, not a replacement web mockup."""
import tempfile
from pathlib import Path
from PIL import Image

source = Path(tempfile.gettempdir()) / 'gclock-preview.png'
im = Image.open(source).convert('RGBA')
assert im.size == (640, 860)
assert im.getpixel((600, 100))[3] == 0, 'Wallpaper must stay transparent'
assert im.getpixel((200, 400))[3] > 200, 'Minute capsule is present'
assert any(im.getpixel((x, 430))[3] > 240 for x in range(30, 130)), 'Hour text is present'
# No underlying dial labels may leak through the minute capsule.
assert len({im.getpixel((220, y)) for y in range(450, 465)}) == 1, 'Dial bleeds through capsule'
# Drawing text directly can inherit desktop subpixel AA and cause green fringes
# on transparent surfaces. Neutral white strokes must stay neutral.
assert all(abs(r - g) <= 1 and abs(g - b) <= 1
           for x in range(20, 140) for y in range(375, 480)
           for r, g, b, a in [im.getpixel((x, y))] if a > 50), 'Colored text fringes'
black = Image.new('RGBA', im.size, (0, 0, 0, 255))
black.alpha_composite(im)
black.convert('RGB').save(source.with_name('gclock-preview-black.png'))
print('Cairo pixel checks passed: transparency, capsule, hour and clean masking')
