# RUP template execution contract

## Reference

- Authoritative DOCX: `C:\Studybase\Use-case Specs --rup_ucspec.docx`
- Task-local byte copy: `C:\Studybase\FitCV\output\rup_restructure_work\rup_template_working.docx`
- SHA-256: `202D7854BA01305347F1A64BAE30DC8E78E8B9D8EF65F02B743757D9C812029F`
- Reference page count: 5 pages, established from the supplied Word screenshots and cached TOC page numbers.
- Section count: 2.
- Render attempt: `C:\Studybase\FitCV\output\rup_restructure_work\template-reference-render`; blocked because LibreOffice/soffice is unavailable.
- Structural evidence: `C:\Studybase\FitCV\output\rup_restructure_work\template-style-evidence.json` and the packaged section/style audits.

## Page system

- US Letter portrait, 8.5 x 11 inches.
- Margins: 1 inch on all four sides.
- Header distance: 0.5 inch. Footer distance: 0.5 inch.
- Section 1 begins the cover. Section 2 begins on a new page and carries the document metadata header, footer, revision history, TOC, use-case model, and use-case specifications.
- No odd/even-page variants and no different-first-page setting.

## Typography

- Reuse the source styles: `Title`, `Heading 1`, `Heading 2`, `Normal`, `Tabletext`, `InfoBlue`, `toc 1`, and `toc 2`.
- Preserve the source theme, fonts, spacing, and named styles. Do not add the blue FitCV design system from the previous custom document.
- Cover title remains centered and uses the source `Title` role.
- Major document sections use `Heading 1`; individual use cases use `Heading 2`.
- Numbered basic and alternative-flow steps use the source numbering definitions and restart at 1 inside each use case/flow.

## Tables and lists

- Revision History: four columns (`Date`, `Version`, `Description`, `Author`) using the source `Normal Table` pattern.
- Use-case specification: two-column `Table Grid` pattern.
- Left label column contains the field name. Right column contains the complete value or flow.
- Required source rows only: `Use case Name`, `Brief description`, `Actors`, `Basic Flow`, `Alternative Flows`, `Pre-conditions`, and `Post-conditions`.
- Do not add `Trigger`, `Business Rules`, or any other field absent from the source sample.
- Post-conditions use one prose statement, matching the source sample.
- Alternative flows use the source narrative pattern: branch from a numbered Basic Flow step, describe the alternate behavior, then state where the Basic Flow continues or that the use case ends.

## Components

- Cover: team name, project title, document type, version.
- Repeating document header: project name, document type, document identifier, version, and date.
- Footer: confidentiality label, company/team/year, and page number field.
- Revision History table.
- Automatic Table of Contents field using Heading 1-3.
- One overall FitCV use-case diagram with a figure caption.
- Twelve use-case specification tables following the source sample.

## Content flow

1. Cover page.
2. Revision History.
3. Table of Contents.
4. `1. Use-case Model`: model explanation, polished FitCV diagram, and UML relationship summary.
5. `2. Use-case Specifications`: UC-01 through UC-12, each as one source-style two-column table.

The previous custom `Document Purpose`, `System Overview`, `Actors`, `Use Case List`, `Common Exception Rules`, `Weekly Report Retro Add-on`, and `Review Notes` sections are not copied as standalone sections. Relevant actor, exception, and business-rule content is embedded into each use case. Weekly retro remains outside the RUP use-case document.

## Slot map

- Cover placeholders: rewrite.
- Header metadata placeholders: rewrite.
- Footer company placeholder: rewrite; preserve the page-number field.
- Revision-history sample row: rewrite; unused rows may remain blank.
- TOC: preserve the field and set document fields to refresh on open.
- Use-case model placeholder image/text: replace with the verified FitCV diagram and relationship explanation.
- Example `Add a product to cart` and `Create a new account` content: remove and replace with UC-01 through UC-12.
- Blue instructional text: remove from the final deliverable.

## Package preservation

Preserve unless the planned content requires a documented change:

- `[Content_Types].xml`
- `_rels/.rels`
- `word/styles.xml`
- `word/numbering.xml`
- `word/theme/theme1.xml`
- `word/fontTable.xml`
- `word/webSettings.xml`
- footnote and endnote parts
- header/footer relationships and page-number fields

Editable parts:

- `word/document.xml`
- header text in `word/header1.xml` and `word/header2.xml`
- footer placeholder text in `word/footer1.xml`
- the model image relationship/media item
- `word/settings.xml` only to enable field refresh.

## Fidelity gates

- The retained reference remains unchanged.
- Final page geometry stays US Letter portrait with 1-inch margins.
- Source header/footer style and page numbering remain recognizable.
- Source heading and table styles are reused.
- TOC field exists and is marked for refresh.
- Exactly 12 use-case headings and 12 specification tables exist.
- Every Basic Flow restarts at Step 1.
- Every alternative/exception flow includes a return/resume point.
- UC-07 includes UC-10 in both the model and its detailed flow.
- No instructional placeholder text remains.
- No weekly-retro or review-note section appears in the final RUP document.
