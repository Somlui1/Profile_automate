with open("scratch/pdf_extracted.txt", "r", encoding="utf-8") as f:
    text = f.read()

print("Length of text:", len(text))
for i, line in enumerate(text.splitlines()):
    if any(word in line for word in ["Email", "Internet", "Telephone", "Printer", "User ID"]):
        safe_line = repr(line).encode('ascii', 'backslashreplace').decode('ascii')
        print(f"Line {i}: {safe_line}")
