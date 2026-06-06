import re
import os
import io
import requests
import pypdf
from typing import Tuple, List, Dict, Any
from core.exceptions import PDFParsingError, PDFValidationError

def download_pdf_from_url(url: str) -> bytes:
    """
    Downloads a PDF file from a given URL.
    
    Args:
        url (str): The HTTP/HTTPS URL of the PDF file.
        
    Returns:
        bytes: Raw binary content of the downloaded PDF.
        
    Raises:
        PDFParsingError: If downloading the file fails.
    """
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        
        # Verify content type looks like a PDF
        content_type = response.headers.get("content-type", "").lower()
        if "application/pdf" not in content_type and not url.lower().endswith(".pdf"):
            raise PDFParsingError("The URL does not point to a valid PDF document.")
            
        return response.content
    except Exception as e:
        raise PDFParsingError(f"Failed to download PDF from URL: {str(e)}")

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """
    Extracts text from PDF binary data.
    
    Args:
        pdf_bytes (bytes): The raw bytes of the PDF.
        
    Returns:
        str: Extracted text.
        
    Raises:
        PDFParsingError: If extraction fails.
    """
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        reader = pypdf.PdfReader(pdf_file)
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
                
        extracted_text = "\n".join(text_parts)
        if not extracted_text.strip():
            raise PDFParsingError("No text content could be extracted from the PDF. It may be scanned or empty.")
            
        return extracted_text
    except Exception as e:
        if isinstance(e, PDFParsingError):
            raise e
        raise PDFParsingError(f"Failed to read PDF binary stream: {str(e)}")

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extracts all text from a local PDF file.
    
    Args:
        pdf_path (str): Path to the local PDF file.
        
    Returns:
        str: Extracted text.
        
    Raises:
        FileNotFoundError: If the file does not exist.
        PDFParsingError: If extraction fails.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")
        
    try:
        with open(pdf_path, "rb") as f:
            return extract_text_from_pdf_bytes(f.read())
    except Exception as e:
        if isinstance(e, (FileNotFoundError, PDFParsingError)):
            raise e
        raise PDFParsingError(f"Failed to open local PDF file: {str(e)}")

def verify_format(text: str) -> Tuple[bool, List[str]]:
    """
    Verifies that the PDF text matches the expected IT Resource Request template.
    
    Args:
        text (str): The extracted text from the PDF.
        
    Returns:
        Tuple[bool, List[str]]: (is_valid, error_list)
    """
    errors = []
    
    # 1. Verify main structural section headers
    required_headers = [
        "ข้อมูลการขอใช้ทรัพยากรด้านเทคโนโลยีสารสนเทศ",
        "Information Technology Resource",
        "ข้อมูลผู้ขอใช้ / Requester Information",
        "ข้อมูลการขอใช้ / Request Information"
    ]
    for header in required_headers:
        if header not in text:
            errors.append(f"Missing main structural header: '{header}'")
            
    # 2. Verify individual requester field labels
    required_requester_fields = [
        "บริษัท / Company",
        "ชื่อ - สกุล(ไทย)",
        "Name-Surname (English)",
        "รหัสพนักงาน / Employee ID",
        "ตำแหน่ง / Position",
        "ฝ่าย",
        "แผนก / Department",
        "เบอร์ภายใน / Ext.",
        "เบอร์มือถือ / Mobile Phone",
            ]
    # 3. Verify specific request numbered items
    required_request_items = [
        (r"\d+\s*\.?\s*User\s*ID", "User ID"),
        (r"\d+\s*\.?\s*Email", "Email"),
        (r"\d+\s*\.?\s*Internet", "Internet"),
        (r"\d+\s*\.?\s*Telephone", "Telephone"),
        (r"\d+\s*\.?\s*Printer", "Printer")
    ]
    for pattern, name in required_request_items:
        if not re.search(pattern, text, re.IGNORECASE):
            errors.append(f"Missing request option item label: '{name}'")
            
    return len(errors) == 0, errors
 
def parse_text(text: str) -> Dict[str, Any]:
    """
    Parses key-value details from the verified PDF text.
    
    Args:
        text (str): The verified text from the PDF.
        
    Returns:
        Dict[str, Any]: Nested dictionary matching the output JSON schema.
    """
    parts = re.split(r"ข้อมูลการขอใช้\s*/\s*Request\s*Information", text, flags=re.IGNORECASE)
    request_section_text = parts[1] if len(parts) > 1 else ""
    
    req_parts = re.split(r"ข้อมูลผู้ขอใช้\s*/\s*Requester\s*Information", parts[0], flags=re.IGNORECASE)
    header_section_text = req_parts[0]
    requester_section_text = req_parts[1] if len(req_parts) > 1 else ""
    
    # --- Parse Header Section ---
    date_val = ""
    doc_no_val = ""
    date_doc_match = re.search(r"วันที่ / Date\s*:\s*(\S+)\s+เลขที่เอกสาร / Doc. No.\s*:\s*(\S+)", header_section_text)
    if date_doc_match:
        date_val = date_doc_match.group(1).strip()
        doc_no_val = date_doc_match.group(2).strip()
    else:
        for line in header_section_text.splitlines():
            m = re.search(r"วันที่ / Date\s*:\s*(\S+)", line)
            if m:
                date_val = m.group(1).strip()
            m = re.search(r"เลขที่เอกสาร / Doc. No.\s*:\s*(\S+)", line)
            if m:
                doc_no_val = m.group(1).strip()
                
    # --- Parse Requester Section ---
    company_val = ""
    name_thai_val = ""
    name_eng_val = ""
    emp_id_val = ""
    position_val = ""
    dept_group_val = ""
    dept_val = ""
    ext_val = ""
    mobile_val = ""
    supervisor_val = ""
    supervisor_pos_val = ""
    address_val = ""
    zip_code_val = ""
    
    requester_lines = [l.strip() for l in requester_section_text.splitlines() if l.strip()]
    
    for line in requester_lines:
        if "บริษัท / Company" in line:
            m = re.search(r"บริษัท / Company\s*:\s*(.*)", line)
            if m:
                company_val = m.group(1).strip()
                
        if "ชื่อ - สกุล(ไทย)" in line or "ชื่อ-สกุล" in line:
            m = re.search(r"(?:ชื่อ\s*-\s*สกุล\(ไทย\)|ชื่อ\s*-\s*สกุล)\s*(.*?)\s+Name-Surname \(English\)\s+(.*)", line, re.IGNORECASE)
            if m:
                name_thai_val = m.group(1).strip()
                name_eng_val = m.group(2).strip()
                
        if "รหัสพนักงาน / Employee ID" in line or "รหัสพนักงาน" in line:
            m = re.search(r"(?:รหัสพนักงาน\s*/\s*Employee ID|รหัสพนักงาน)\s*(.*?)\s+ตำแหน่ง / Position\s+(.*)", line, re.IGNORECASE)
            if m:
                emp_id_val = m.group(1).strip()
                position_val = m.group(2).strip()
                
        if "ฝ่าย" in line and "แผนก / Department" in line:
            m = re.search(r"ฝ่าย\s+(.*?)\s+แผนก\s*/\s*Department\s+(.*)", line, re.IGNORECASE)
            if m:
                dept_group_val = m.group(1).strip()
                dept_val = m.group(2).strip()
                
        if "เบอร์ภายใน / Ext." in line or "เบอร์ภายใน" in line:
            m = re.search(r"(?:เบอร์ภายใน\s*/\s*Ext\.|เบอร์ภายใน)\s*(.*?)\s+เบอร์มือถือ / Mobile Phone\s+(.*)", line, re.IGNORECASE)
            if m:
                ext_val = m.group(1).strip()
                mobile_val = m.group(2).strip()
                
        if "ชื่อหัวหน้า / Supervisor" in line or "ชื่อหัวหน้า" in line:
            m = re.search(r"(?:ชื่อหัวหน้า\s*/\s*Supervisor|ชื่อหัวหน้า)\s*(.*?)\s+ตำแหน่ง / Position\s+(.*)", line, re.IGNORECASE)
            if m:
                supervisor_val = m.group(1).strip()
                supervisor_pos_val = m.group(2).strip()
                
        if "ที่อยู่ / Address" in line or "ที่อยู่" in line:
            m = re.search(r"(?:ที่อยู่\s*/\s*Address|ที่อยู่)\s*(.*)", line, re.IGNORECASE)
            if m:
                address_val = m.group(1).strip()
                
        if "(ตามทะเบียนบ้าน)" in line or "ตามทะเบียนบ้าน" in line:
            m = re.search(r"(?:\(ตามทะเบียนบ้าน\)|ตามทะเบียนบ้าน)\s*(.*?)\s+รหัสไปรษณีย์\s+(\d+)", line, re.IGNORECASE)
            if m:
                addr2 = m.group(1).strip()
                address_val = re.sub(r'\s+', ' ', f"{address_val} {addr2}").strip()
                zip_code_val = m.group(2).strip()
                
    # --- Parse Request Info Section ---
    req_text_clean = "\n".join([l.strip() for l in request_section_text.splitlines() if l.strip()])
    
    user_id_reason = ""
    user_id_match = re.search(r"\d+\s*\.?\s*User\s*ID\s+เหตุผล\s*:\s*(.*?)(?=\s*\d+\s*\.?\s*[a-zA-Z]|\s*$)", req_text_clean, re.DOTALL | re.IGNORECASE)
    if user_id_match:
        user_id_reason = user_id_match.group(1).strip()
        
    email_reason = ""
    email_match = re.search(r"\d+\s*\.?\s*Email\s+เหตุผล\s*:\s*(.*?)(?=\s*\d+\s*\.?\s*[a-zA-Z]|\s*$)", req_text_clean, re.DOTALL | re.IGNORECASE)
    if email_match:
        email_reason = email_match.group(1).strip()
        
    internet_level = ""
    internet_reason = ""
    internet_match = re.search(r"\d+\s*\.?\s*Internet\s+ระดับ\s*:\s*(.*?)\s*\n\s*เหตุผล\s*:\s*(.*?)(?=\s*\d+\s*\.?\s*[a-zA-Z]|\s*$)", req_text_clean, re.DOTALL | re.IGNORECASE)
    if internet_match:
        internet_level = internet_match.group(1).strip()
        internet_reason = internet_match.group(2).strip()
        
    phone_type = ""
    phone_reason = ""
    phone_match = re.search(r"\d+\s*\.?\s*Telephone\s+ประเภท\s*:\s*(.*?)\s*\n\s*เหตุผล\s*:\s*(.*?)(?=\s*\d+\s*\.?\s*[a-zA-Z]|\s*$)", req_text_clean, re.DOTALL | re.IGNORECASE)
    if phone_match:
        phone_type = phone_match.group(1).strip()
        phone_reason = phone_match.group(2).strip()
        
    printer_model = ""
    printer_type = ""
    printer_reason = ""
    printer_match = re.search(r"\d+\s*\.?\s*Printer\s+รุ่น\s*:\s*(.*?)\s+ประเภท\s*:\s*(.*?)\s*\n\s*เหตุผล\s*:\s*(.*?)$", req_text_clean, re.DOTALL | re.IGNORECASE)
    if printer_match:
        printer_model = printer_match.group(1).strip()
        printer_type = printer_match.group(2).strip()
        printer_reason = printer_match.group(3).strip()
    
    return {
        "document_info": {
            "date": date_val,
            "doc_no": doc_no_val
        },
        "requester_info": {
            "company": company_val,
            "name_thai": name_thai_val,
            "name_english": name_eng_val,
            "employee_id": emp_id_val,
            "position": position_val,
            "department_group": dept_group_val,
            "department": dept_val,
            "ext": ext_val,
            "mobile_phone": mobile_val,
            "supervisor_name": supervisor_val,
            "supervisor_position": supervisor_pos_val,
            "address": address_val,
            "zip_code": zip_code_val
        },
        "request_info": {
            "user_id": {
                "reason": user_id_reason
            },
            "email": {
                "reason": email_reason
            },
            "internet": {
                "level": internet_level,
                "reason": internet_reason
            },
            "telephone": {
                "type": phone_type,
                "reason": phone_reason
            },
            "printer": {
                "model": printer_model,
                "type": printer_type,
                "reason": printer_reason
            }
        }
    }
