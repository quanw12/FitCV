from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SOURCE = Path(r"C:\Studybase\FitCV\output\usecase_final_pages")
OUTPUT = Path(r"C:\Studybase\FitCV\output\usecase_final_contact_sheet.png")
paths = sorted(SOURCE.glob("page-*.png"), key=lambda path: int(path.stem.split("-")[-1]))

columns = 4
thumb_width = 300
gap = 20
label_height = 30
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 18)

thumbs = []
for path in paths:
    page = Image.open(path).convert("RGB")
    ratio = thumb_width / page.width
    thumb = page.resize(
        (thumb_width, int(page.height * ratio)),
        Image.Resampling.LANCZOS,
    )
    thumbs.append((path.stem, thumb))

rows = (len(thumbs) + columns - 1) // columns
cell_height = max(image.height for _, image in thumbs) + label_height
sheet = Image.new(
    "RGB",
    (
        columns * thumb_width + (columns + 1) * gap,
        rows * cell_height + (rows + 1) * gap,
    ),
    "#D1D5DB",
)
draw = ImageDraw.Draw(sheet)

for index, (label, image) in enumerate(thumbs):
    row, column = divmod(index, columns)
    x = gap + column * (thumb_width + gap)
    y = gap + row * cell_height
    draw.text((x, y), label, fill="#111827", font=font)
    sheet.paste(image, (x, y + label_height))

sheet.save(OUTPUT, optimize=True)
print(OUTPUT)
