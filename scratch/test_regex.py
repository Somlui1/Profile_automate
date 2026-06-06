import re

with open("scratch/pdf_extracted.txt", "r", encoding="utf-8") as f:
    text = f.read()

parts = re.split(r"ข้อมูลการขอใช้ / Request Information", text, flags=re.IGNORECASE)
if len(parts) < 2:
    parts = re.split(r"Request\s*Information", text, flags=re.IGNORECASE)

request_section_text = parts[1] if len(parts) > 1 else text
req_text_clean = "\n".join([l.strip() for l in request_section_text.splitlines() if l.strip()])

# Flexible regexes using \d+ instead of hardcoded numbers:
user_id_match = re.search(r"\d+\s*\.?\s*User\s*ID\s+เหตุผล\s*:\s*(.*?)(?=\s*\d+\s*\.?\s*(?:Email|AERP|Internet)|\s*$)", req_text_clean, re.DOTALL | re.IGNORECASE)
user_id_reason = user_id_match.group(1).strip() if user_id_match else ""

email_match = re.search(r"\d+\s*\.?\s*Email\s+เหตุผล\s*:\s*(.*?)(?=\s*\d+\s*\.?\s*(?:Internet|Telephone)|\s*$)", req_text_clean, re.DOTALL | re.IGNORECASE)
email_reason = email_match.group(1).strip() if email_match else ""

internet_match = re.search(r"\d+\s*\.?\s*Internet\s+ระดับ\s*:\s*(.*?)\s*\n\s*เหตุผล\s*:\s*(.*?)(?=\s*\d+\s*\.?\s*(?:Telephone|Printer)|\s*$)", req_text_clean, re.DOTALL | re.IGNORECASE)
internet_level = internet_match.group(1).strip() if internet_match else ""
internet_reason = internet_match.group(2).strip() if internet_match else ""

phone_match = re.search(r"\d+\s*\.?\s*Telephone\s+ประเภท\s*:\s*(.*?)\s*\n\s*เหตุผล\s*:\s*(.*?)(?=\s*\d+\s*\.?\s*Printer|\s*$)", req_text_clean, re.DOTALL | re.IGNORECASE)
phone_type = phone_match.group(1).strip() if phone_match else ""
phone_reason = phone_match.group(2).strip() if phone_match else ""

printer_match = re.search(r"\d+\s*\.?\s*Printer\s+รุ่น\s*:\s*(.*?)\s+ประเภท\s*:\s*(.*?)\s*\n\s*เหตุผล\s*:\s*(.*?)$", req_text_clean, re.DOTALL | re.IGNORECASE)
printer_model = printer_match.group(1).strip() if printer_match else ""
printer_type = printer_match.group(2).strip() if printer_match else ""
printer_reason = printer_match.group(3).strip() if printer_match else ""

def safe_print(label, val):
    safe_val = repr(val).encode('ascii', 'backslashreplace').decode('ascii')
    print(f"{label}: {safe_val}")

print("--- Parsed Results ---")
safe_print("User ID Reason", user_id_reason)
safe_print("Email Reason", email_reason)
safe_print("Internet Level", internet_level)
safe_print("Internet Reason", internet_reason)
safe_print("Phone Type", phone_type)
safe_print("Phone Reason", phone_reason)
safe_print("Printer Model", printer_model)
safe_print("Printer Type", printer_type)
safe_print("Printer Reason", printer_reason)
