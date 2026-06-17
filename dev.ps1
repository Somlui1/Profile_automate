Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🚀 Starting API Server in a new terminal window..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Write-Host 'Active API Process' -ForegroundColor Green; & .\.venv\Scripts\Activate.ps1; uvicorn api.main:app --host localhost --port 8000 --reload"
