from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel, HttpUrl
from services.pdf_service import (
    extract_text_from_pdf_bytes,
    verify_format,
    parse_text,
    download_pdf_from_url
)
from core.exceptions import PDFParsingError, PDFValidationError

router = APIRouter()

class URLRequest(BaseModel):
    url: str

@router.post("/file", status_code=status.HTTP_200_OK)
async def parse_pdf_file(file: UploadFile = File(...)):
    """
    Upload a PDF file, verify its template structure, and return the parsed data preview.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file extension. Only PDF files are supported."
        )
        
    try:
        content = await file.read()
        text = extract_text_from_pdf_bytes(content)
        
        # Verify format
        is_valid, errors = verify_format(text)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": "PDF format does not match the IT Resource Request template.",
                    "errors": errors
                }
            )
            
        parsed_data = parse_text(text)
        return parsed_data
        
    except HTTPException as he:
        raise he
    except PDFParsingError as pe:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(pe)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during parsing: {str(e)}"
        )

@router.post("/url", status_code=status.HTTP_200_OK)
def parse_pdf_url(payload: URLRequest):
    """
    Provide a URL to a PDF file, download it, verify its structure, and return parsed data preview.
    """
    url_str = payload.url
    try:
        # Download PDF bytes
        content = download_pdf_from_url(url_str)
        text = extract_text_from_pdf_bytes(content)
        
        # Verify format
        is_valid, errors = verify_format(text)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": "PDF format does not match the IT Resource Request template.",
                    "errors": errors
                }
            )
            
        parsed_data = parse_text(text)
        return parsed_data
        
    except HTTPException as he:
        raise he
    except PDFParsingError as pe:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(pe)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during URL download/parse: {str(e)}"
        )
