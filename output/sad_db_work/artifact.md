# SAD database-section edit contract

## Reference

- Authoritative template: `C:\Studybase\rup_sad.docx`
- Task-local reference copy: `C:\Studybase\FitCV\output\sad_db_work\rup_sad_reference.docx`
- SHA-256: `F6FF8E3B1D916AFA68E60B16AA1394D3F8AA238A7C871598B4E73167BA055320`
- Reference render: `C:\Studybase\FitCV\output\sad_db_work\reference_render`
- Reference page count: 5.
- Section count: 2.
- Structural evidence: `reference-style.json`, section audit, heading audit, field report, and content-control inventory.

## Page system

- US Letter portrait, 8.5 x 11 inches.
- Margins: 1 inch on all sides.
- Header/footer distance: 0.5 inch.
- Section 1 is the cover. Section 2 contains Revision History, TOC, and body.
- Existing first/odd/even header and footer parts, metadata fields, page number, and total-page fields are preserve-only.

## Typography and numbering

- Reuse the source `Title`, `Heading 1`, `Heading 2`, `Heading 3`, `Normal`, `InfoBlue`, `Tabletext`, `toc 1`, and `toc 2` styles.
- Preserve source multilevel heading numbering so the edited subsection appears as 4.1 and later headings retain their source numbering.
- Body prose and captions reuse source formatting; new tables use the source grid/table conventions without introducing a new color system.

## Existing content flow

1. Cover.
2. Revision History.
3. Table of Contents.
4. Introduction.
5. Architectural Goals and Constraints.
6. Use-Case Model.
7. Logical View.
   - Component: abc.
   - Component: xyz.
8. Deployment.
9. Implementation View.

## Authorized edit slot

- Replace only the `Heading 2` paragraph `Component: abc` and its two following blue guidance paragraphs.
- New heading: `Component: Database`.
- Insert the FitCV database design content before the untouched `Component: xyz` subsection.
- Preserve `Component: xyz`, all earlier/later sections, cover, Revision History, TOC field, headers, footers, styles, numbering, and instructional content outside the authorized slot.
- Updating the cached TOC and page-count fields is allowed because pagination will change.
- The original template remains unchanged; final output uses a different path.

## Database design content

- Source of truth: `C:\Studybase\FitCV\database\full_schema.sql`.
- PA3 requirement: ER models must show entities, attributes, and relationships; the design belongs under the database component in the SAD.
- Include:
  - database component overview and responsibilities;
  - MySQL 8/InnoDB/utf8mb4 physical decisions;
  - two legible ER diagrams covering all 19 entities;
  - entity catalog with keys, important attributes, and purpose;
  - relationship/cardinality and delete-behavior table;
  - integrity constraints and index/performance strategy.

## Package preservation

Preserve unless the authorized edit requires a relationship addition:

- package content types and root relationships;
- all source styles, numbering, theme, font table, web settings, footnotes, and endnotes;
- existing header/footer parts and relationships;
- document properties except title/subject metadata if Word refreshes cached fields;
- existing body XML outside the authorized Component: abc range.

Editable:

- `word/document.xml` inside the authorized subsection;
- `word/_rels/document.xml.rels` for new diagram images;
- new `word/media/*` parts;
- cached TOC/page fields through Microsoft Word update;
- `word/settings.xml` only for field-refresh behavior if required.

## Fidelity gates

- Original reference SHA-256 remains unchanged.
- Exactly two document sections with unchanged page geometry.
- All source body paragraphs outside the `Component: abc` slot remain text-identical and in the same order.
- `Component: xyz`, Deployment, and Implementation View remain present and unchanged.
- Final TOC contains `Component: Database` and subsequent sections with correct page numbers.
- Both ER diagrams are readable at page width and include entity names, PK/FK attributes, and cardinality labels.
- Entity catalog covers all 19 tables from `full_schema.sql`.
- No text overlaps, clips, or produces unexplained blank pages.
