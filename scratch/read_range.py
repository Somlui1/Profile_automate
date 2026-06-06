with open("api/services/pdf_service.py", "r", encoding="latin-1") as f:
    lines = f.readlines()

for idx in range(110, min(145, len(lines))):
    safe_line = repr(lines[idx]).encode('ascii', 'backslashreplace').decode('ascii')
    print(f"{idx+1}: {safe_line}")
