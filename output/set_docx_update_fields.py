from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from lxml import etree


path = Path(r"C:\Studybase\FitCV_Use_Case_Specification_RUP.docx")
namespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
tag = f"{{{namespace}}}updateFields"
val = f"{{{namespace}}}val"

with ZipFile(path, "r") as source, NamedTemporaryFile(
    suffix=".docx", dir=path.parent, delete=False
) as temp_file:
    temp_path = Path(temp_file.name)
    with ZipFile(temp_file, "w", compression=ZIP_DEFLATED) as target:
        for item in source.infolist():
            payload = source.read(item.filename)
            if item.filename == "word/settings.xml":
                root = etree.fromstring(payload)
                node = root.find(tag)
                if node is None:
                    node = etree.Element(tag)
                    root.append(node)
                node.set(val, "true")
                payload = etree.tostring(
                    root,
                    xml_declaration=True,
                    encoding="UTF-8",
                    standalone=True,
                )
            clone = ZipInfo(item.filename, item.date_time)
            clone.compress_type = item.compress_type
            clone.comment = item.comment
            clone.extra = item.extra
            clone.internal_attr = item.internal_attr
            clone.external_attr = item.external_attr
            clone.create_system = item.create_system
            target.writestr(clone, payload)

temp_path.replace(path)
print(path)
