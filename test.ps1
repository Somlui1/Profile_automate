param(
    [string]$Mode = "api" # Default mode is 'api', other options: 'virtual', 'mock'
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🧪 Running test with Mode: $Mode" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Activate venv if it exists
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    & .\.venv\Scripts\Activate.ps1
}

# Run the mock test script
python temp/mock_test_sync_user.py $Mode localhost:8000
