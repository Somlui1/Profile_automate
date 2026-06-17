Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🚀 Starting RQ Worker..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

& .\.venv\Scripts\Activate.ps1
python worker/run.py
