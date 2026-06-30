# Brainstorm: Auto-select Internet Level in PDF Provisioning Tab

This document details the investigation and proposed options to resolve the issue where the `Internet Level` is not auto-selecting when parsing `temp/request.pdf`.

## Goal
Auto-select the correct Internet Level (`A`, `B`, `C`, or `D`) in Step 2 of the frontend provisioning wizard when parsing a PDF.

## Constraints
- Must maintain backward compatibility.
- Must handle variations in PDF output (e.g. `"Level C"`, `"C"`, `"Internet Level C"`).
- Must safely fallback to default `'A'`.

## Known context
- `api/services/pdf_service.py` parses `Internet` from PDF and returns `{"request_info": {"internet": {"level": "C", "reason": "..."}}}` (or similar raw values).
- In `PDFProvisionTab.tsx`, `mapLocalRawToADSchema()` takes the raw response and converts it into the AD mapping payload.
- However, `mapLocalRawToADSchema()` **does not map** the internet level into the mapped payload's `custom_attributes.internet_type`.
- Consequently, when `populateFormFromExtractedMap` is called, `attrs.internet_type` is undefined, causing it to fall back to the default `'A'`.

## Risks
- Raw text values of `internet.level` from PDF parser might vary (e.g., `"Level C"`, `"ระดับ C"`, `"C"`). If we do not normalize the parsed text, auto-selection will still fail for some formats.

## Options (2–4)

### Option 1: Normalize and inject `internet_type` in `mapLocalRawToADSchema()` (Recommended)
Add logic in `mapLocalRawToADSchema()` to check `web.level`, extract the clean character (`A`, `B`, `C`, or `D`), and populate `custom_attributes.internet_type`.
- **Pros:** Keeps all schema mapping centralized. Extremely robust mapping and normalization.
- **Cons:** None.

### Option 2: Fallback parsing in `populateFormFromExtractedMap()` directly
Read `rawJsonOutput` or `mappedJsonOutput` directly inside the form population step and parse it on the fly.
- **Pros:** Quick fix.
- **Cons:** Messes up the clean flow where `populateFormFromExtractedMap` only reads from the mapped layout.

## Recommendation
We recommend **Option 1**. By normalizing the string `web.level` to find `'A'`, `'B'`, `'C'`, or `'D'` and then saving it as `internet_type` inside the `custom_attributes` dictionary, the frontend's mapping pipeline will automatically populate the state properly.

## Acceptance criteria
1. Uploading a PDF containing `Internet ระดับ : C` correctly parses the document.
2. The dropdown in Step 2 automatically selects `'C'`.
3. Fallback defaults to `'A'` if not found.
