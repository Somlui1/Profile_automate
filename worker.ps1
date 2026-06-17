Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🚀 Starting RQ Worker in a new terminal window..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Write-Host 'Active RQ Worker Process' -ForegroundColor Green; & .\.venv\Scripts\Activate.ps1; python worker/run.py"
