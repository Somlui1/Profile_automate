import sys
import requests
import pypdf
import io
import re

url = "http://intranet.aapico.com/WORK-FLOW-AAPICO-20250411/pdf-it-requisition-reprint.php?reqid=EF-26050055-J8"
response = requests.get(url)
pdf_file = io.BytesIO(response.content)
reader = pypdf.PdfReader(pdf_file)
text = "\n".join([page.extract_text() for page in reader.pages])

with open("scratch/pdf_extracted.txt", "w", encoding="utf-8") as f:
    f.write(text)

print("Saved extracted text to scratch/pdf_extracted.txt")

# Let's check the request option items specifically:
required_request_items = [
    (r"1\s*\.?\s*User\s*ID", "1.User ID"),
    (r"2\s*\.?\s*Email", "2.Email"),
    (r"3\s*\.?\s*Internet", "3.Internet"),
    (r"4\s*\.?\s*Telephone", "4.Telephone"),
    (r"5\s*\.?\s*Printer", "5.Printer")
]

print("--- Request Items Match Check ---")
for pattern, name in required_request_items:
    match = re.search(pattern, text, re.IGNORECASE)
    print(f"{name} pattern '{pattern}': {'FOUND' if match else 'NOT FOUND'}")
    if match:
        print("  Match text:", repr(match.group(0)))
