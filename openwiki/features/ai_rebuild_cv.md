---
type: Feature
title: AI Rebuild CV
description: Feature that converts uploaded CVs (PDF/DOCX) into standardized PDF format using AI for data extraction and headless Chromium for PDF generation.
tags: [feature, ai, cv, resume, pdf]
---

# AI Rebuild CV

The AI Rebuild CV feature helps students create a standardized, professional PDF version of their CV by extracting information from an uploaded PDF or DOCX file using AI, then rendering it into a consistent format.

## Overview

When a student uploads a CV, this feature:
1. Extracts text from the PDF/DOCX (using `pypdf` for native text, or Gemini OCR for scanned PDFs)
2. Uses Google Gemini to extract and structure CV data (skills, experience, education, etc.)
3. Renders the structured data into HTML using a Jinja2 template
4. Converts the HTML to PDF using headless Chromium (Playwright)
5. Generates a thumbnail preview of the PDF
6. Returns the extracted data (as JSON), the PDF (base64-encoded), and the thumbnail (base64-encoded)

The entire process runs in a temporary directory and does not store files persistently or modify the database.

## How It Works

### Processing Pipeline

```
Uploaded PDF/DOCX
        → Text Extraction (pypdf or Gemini OCR for scans)
        → Gemini Extracts Structured CV Data (with JSON Schema validation)
        → HTML Rendering (Jinja2 template)
        → PDF Generation (Headless Chromium via Playwright)
        → Thumbnail Generation (First page of PDF)
        → Return: preview_json, pdf_base64, thumbnail_base64
```

### Key Characteristics

- **Stateless**: No persistent file storage; everything happens in a `TemporaryDirectory`.
- **No Database Changes**: The feature does not write to the database.
- **AI-Powered Extraction**: Uses Google Gemini for understanding and structuring CV content.
- **Headless Chromium**: Relies on Playwright-installed Chromium for PDF rendering.
- **Source-Grounded**: Gemini extraction is validated against the source document; unsupported evidence is removed.
- **Structured Output**: Uses Pydantic to validate Gemini's JSON response.

## Configuration

The feature is configured in `backend/.env`:

```env
GEMINI_API_KEY=<google-ai-studio-api-key>
GEMINI_MODEL=gemini-3.1-flash-lite
```

> **Note**: For OCR of scanned PDFs, the same `GEMINI_API_KEY` and `GEMINI_MODEL` are used (see OCR section below).

### OCR for Scanned PDFs

If the uploaded PDF does not have a text layer, the backend automatically uses Gemini Document OCR (if configured). To enable OCR, add these variables to `backend/.env`:

```env
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=high
OCR_PROVIDER=gemini
OCR_TIMEOUT_SECONDS=120
OCR_MAX_OUTPUT_TOKENS=20000
```

> **Note**: Leave `OCR_MODEL` empty to use the same model as `GEMINI_MODEL`. Set `OCR_PROVIDER=disabled` to skip OCR for scanned PDFs (they will fail if no text layer is present).

## API Endpoint

- **Rebuild CV**:
  ```http
  POST /api/cv/rebuild
  ```
  - Requires authentication (Student role).
  - Expects `multipart/form-data` with:
    - `file`: The CV file (PDF or DOCX, maximum 10 MB)
  - Returns JSON:
    ```json
    {
      "preview_json": { /* extracted and structured CV data */ },
      "pdf_base64": "<base64-encoded PDF data>",
      "thumbnail_base64": "<base64-encoded thumbnail image (PNG)>"
    }
    ```

## Usage Flow (Student)

1. Log in as a Student.
2. Navigate to the CV upload section (likely in the CV & JD Match Analyzer or profile section).
3. Click to upload a CV file (PDF or DOCX, max 10 MB).
4. Wait for processing (typically a few seconds).
5. Receive:
   - A JSON preview of the extracted CV data (can be reviewed for accuracy).
   - A base64-encoded PDF that can be decoded and saved or displayed.
   - A base64-encoded thumbnail of the PDF (for preview).

## Common Errors

- **400 Bad Request**:
  - Empty file
  - File larger than 10 MB
  - File not a valid PDF or DOCX
- **422 Unprocessable Entity**:
  - Gemini returned invalid CV structure after multiple retries
  - Check `GEMINI_API_KEY`, `GEMINI_MODEL`, and backend logs
- **502 Bad Gateway**:
  - Error calling Gemini or rendering PDF
  - Check Gemini API key, quota, and Chromium installation
  - On Windows: If seeing `NotImplementedError` or `PDF rendering failed`, ensure the backend uses `WindowsProactorEventLoopPolicy` (set in `backend/app/main.py`) or run uvicorn with `--loop none`.

## Important Notes

- The backend **does not** send the API key or the original file to the frontend.
- The original uploaded file is **not** stored; only the extracted data and generated PDF/thumbnail are returned.
- To use this feature, you must install headless Chromium via Playwright (see backend setup).
- In development, if the backend cannot connect to Gemini, check the API key and network connectivity.
- The feature uses the same Gemini model configuration as the Analyzer and Improvement Suggestions (though the model may differ: `gemini-3.1-flash-lite` for Rebuild CV vs `gemini-3.6-flash` for Analyzer).

## Focused Tests

- **Unit Tests**: Likely include tests for the CV rebuild endpoint, file validation, and error cases.
- **Integration Tests**: May test the full pipeline with sample PDF/DOCX files (if available in the test suite).

## Validation Commands

- **Endpoint Test**: After setting up the backend, test with a sample PDF/DOCX:
  ```bash
  curl -X POST 'http://127.0.0.1:8000/api/cv/rebuild' \
    -H "Authorization: Bearer <access_token>" \
    -F "file=@/path/to/sample.pdf"
  ```
  > Replace `<access_token>` with a valid Student token and provide a valid file path.

- **Backend Health**: Ensure the backend is running: `GET /api/health`.

- **Chromium Installation**: Verify that Playwright Chromium is installed by checking if the backend can import and use it (no direct command, but errors will appear in logs if missing).

## Change Navigation

When making changes related to AI Rebuild CV:

1. **Endpoint Changes**: Edit `backend/app/api/cv.py` (or similar) and update the service layer.
2. **Service Logic**: Edit the service that handles the CV rebuild process (likely in `backend/app/services/`).
3. **File Validation**: If changing file size limits or allowed types, update the validation in the endpoint or service.
4. **Gemini Prompt**: If changing what data is extracted from the CV, update the prompt sent to Gemini.
5. **HTML Template**: If changing the CV output format, edit the Jinja2 template used for rendering.
6. **PDF Generation Options**: If adjusting Chromium settings for PDF output, update the service code.
7. **OCR Configuration**: If modifying OCR behavior, update the environment variables and related service code.
8. **Error Handling**: If changing error responses, update the endpoint and service logic accordingly.

Always verify changes by:
- Running the backend test suite.
- Manually testing with various PDF/DOCX files (including scanned ones if OCR is enabled).
- Checking that file size and type validations work correctly.
- Ensuring that the generated PDF is valid and contains the expected information.
- Verifying that no temporary files are left behind (statelessness).
- Confirming that the feature still requires authentication and that users can only process their own uploads (if applicable; note that the endpoint may not check ownership of the CV since it doesn't store it, but the authentication ensures only logged-in users can call it).