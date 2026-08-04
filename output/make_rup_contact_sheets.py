from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont


source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    r"C:\Studybase\FitCV\output\rup_restructure_work\final-render-1"
)
pages = sorted(source.glob("page-*.png"))
out_dir = source / "contact-sheets"
out_dir.mkdir(exist_ok=True)
font = ImageFont.load_default()

thumb_w, thumb_h = 360, 466
label_h = 24
cols, rows = 3, 3
sheet_w, sheet_h = cols * thumb_w, rows * (thumb_h + label_h)

for batch_start in range(0, len(pages), cols * rows):
    sheet = Image.new("RGB", (sheet_w, sheet_h), "white")
    draw = ImageDraw.Draw(sheet)
    for slot, path in enumerate(pages[batch_start : batch_start + cols * rows]):
        image = Image.open(path).convert("RGB")
        image.thumbnail((thumb_w - 16, thumb_h - 16))
        col = slot % cols
        row = slot // cols
        x = col * thumb_w + (thumb_w - image.width) // 2
        y = row * (thumb_h + label_h) + label_h + (thumb_h - image.height) // 2
        draw.text((col * thumb_w + 8, row * (thumb_h + label_h) + 5), path.stem, fill="black", font=font)
        sheet.paste(image, (x, y))
    sheet.save(out_dir / f"contact-{batch_start // (cols * rows) + 1}.png")

print(out_dir)
