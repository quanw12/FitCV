from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


REFERENCE = Path(r"C:\Studybase\FitCV\output\sad_db_work\rup_sad_reference.docx")
TARGET = Path(r"C:\Studybase\FitCV_Software_Architecture_Document_DB_Design.docx")
TEMP = TARGET.with_suffix(".header-restored.docx")


def is_header_part(name):
    return name.startswith("word/header") or (
        name.startswith("word/_rels/header") and name.endswith(".rels")
    )


with ZipFile(REFERENCE, "r") as reference_zip:
    reference_parts = {
        name: reference_zip.read(name)
        for name in reference_zip.namelist()
        if is_header_part(name)
    }

with ZipFile(TARGET, "r") as source_zip, ZipFile(TEMP, "w", ZIP_DEFLATED) as target_zip:
    for item in source_zip.infolist():
        payload = reference_parts.get(item.filename, source_zip.read(item.filename))
        target_zip.writestr(item, payload)

TEMP.replace(TARGET)
print(TARGET)
