# scripts/backup-db.ps1
# Usage: .\scripts\backup-db.ps1

$BACKUP_DIR = "backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$FILENAME = "$BACKUP_DIR/anita_backup_$TIMESTAMP.sql"

if (!(Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR
}

Write-Host "Starting database backup to $FILENAME..." -ForegroundColor Cyan

# Get DB credentials from .env if possible
if (Test-Path ".env") {
    $env_content = Get-Content ".env"
    # Basic parsing for simple .env files
    foreach ($line in $env_content) {
        if ($line -match "^POSTGRES_USER=(.*)$") { $USER = $matches[1] }
        if ($line -match "^POSTGRES_DB=(.*)$") { $DB = $matches[1] }
    }
}

$USER = $USER -replace '"',''
$DB = $DB -replace '"',''

if (-not $USER) { $USER = "anita" }
if (-not $DB) { $DB = "anita" }

# Run pg_dump inside the container
docker exec anita-db pg_dump -U $USER $DB > $FILENAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully!" -ForegroundColor Green
    # Keep only last 7 backups
    $old_backups = Get-ChildItem $BACKUP_DIR | Sort-Object LastWriteTime -Descending | Select-Object -Skip 7
    if ($old_backups) {
        Write-Host "Cleaning up old backups..." -ForegroundColor Yellow
        $old_backups | Remove-Item
    }
} else {
    Write-Host "Backup failed!" -ForegroundColor Red
}
