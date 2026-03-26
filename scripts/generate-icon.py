from PIL import Image, ImageDraw
import os

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'build'), exist_ok=True)
build_dir = os.path.join(os.path.dirname(__file__), '..', 'build')

def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = max(1, size // 16)
    r = size // 5
    draw.rounded_rectangle([margin, margin, size - margin - 1, size - margin - 1],
                            radius=r, fill=(37, 99, 235, 255))
    line_color = (255, 255, 255, 230)
    lw = max(1, size // 32)
    x1 = size * 22 // 100
    x2 = size * 78 // 100
    for y in [size * 36 // 100, size * 50 // 100, size * 64 // 100]:
        draw.rectangle([x1, y - lw, x2, y + lw], fill=line_color)
    xv = size * 35 // 100
    draw.rectangle([xv - lw, size * 28 // 100, xv + lw, size * 72 // 100],
                   fill=(255, 255, 255, 120))
    return img

base = draw_icon(512)

# ICO (Windows)
base.save(
    os.path.join(build_dir, 'icon.ico'),
    sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
)

# PNG (Mac / Linux / README)
base.save(os.path.join(build_dir, 'icon.png'))

# ICNS (Mac) - PNG から electron-builder が自動変換するので PNG で十分
print("Icons generated:", os.listdir(build_dir))
