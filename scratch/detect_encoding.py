for encoding in ['cp874', 'tis-620', 'utf-8', 'latin-1']:
    try:
        with open("api/services/pdf_service.py", "r", encoding=encoding) as f:
            lines = f.readlines()
        print(f"Success with {encoding}, total lines: {len(lines)}")
        break
    except Exception as e:
        print(f"Failed with {encoding}: {e}")
