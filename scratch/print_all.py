with open("scratch/pdf_extracted.txt", "r", encoding="utf-8") as f:
    text = f.read()

safe_text = text.encode('ascii', 'backslashreplace').decode('ascii')
print(safe_text)
