# scripts/check-health.ps1
# Usage: .\scripts\check-health.ps1 [url]

$URL = $args[0]
if (-not $URL) { $URL = "http://localhost:4000/api/health" }

Write-Host "Checking health of $URL..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $URL -Method Get
    if ($response.status -eq "ok") {
        Write-Host "Service is HEALTHY" -ForegroundColor Green
        Write-Host "DB Status: $($response.db)"
        Write-Host "Uptime: $($response.uptime)s"
    } else {
        Write-Host "Service is UNHEALTHY: $($response.status)" -ForegroundColor Red
    }
} catch {
    Write-Host "Service is DOWN or UNREACHABLE" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
