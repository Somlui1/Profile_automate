# Robust PDF URL and Local Path Parser

## Goal
Improve `/api/v1/parse/url` to work in all cases, including when the user inputs a local file path (like `request.pdf`), a `file:///` protocol URL, or standard web URLs.

## Assumptions
- Currently, `download_pdf_from_url` only supports `http://` and `https://` protocols via `requests.get`.
- Passing a local path (like `request.pdf` or `C:\...`) causes an `InvalidSchema` crash.

## Plan

### 1. Refactor `download_pdf_from_url` in `api/services/pdf_service.py`
- Files: `api/services/pdf_service.py`
- Change:
  - Add support for `file:///` protocol by parsing the local path.
  - Add support for direct absolute/relative paths (checking `os.path.exists`).
  - Check paths relative to the project root or the `api` folder.
  - Relax web content-type verification by checking for the `%PDF` magic header in raw bytes.
- Verify: Run python compile check on `services/pdf_service.py`.

### 2. Verification
- Run a verification script that calls `download_pdf_from_url` with:
  1. A standard web PDF URL.
  2. A local relative path (e.g., `request.pdf`).
  3. A `file:///` style path.
- Verify all of them return PDF bytes successfully.

## Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| Accessing sensitive system files | This is a local development/admin tool, but standard path checks are restricted to normal Python file reading capabilities. |
