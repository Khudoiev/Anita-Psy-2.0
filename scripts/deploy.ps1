# Anita AI — Automated Deployment Orchestrator (Local-to-GCP)
# Requirements: gcloud CLI, PowerShell 5.0+

$ProjectID = "gen-lang-client-0274482929"
$InstanceName = "ai-backend"
$Zone = "europe-west1-b"
$User = "aleks90715"

$ZipFile = "deploy_package.zip"
$RemoteDir = "/home/$User"

Write-Host "--- 1. Packing Project ---" -ForegroundColor Cyan
if (Test-Path $ZipFile) { Remove-Item $ZipFile }

# Pack only necessary files
Compress-Archive -Path "backend", "frontend", "admin", "docker-compose.yml", "infra", "scripts", ".env", ".env.local" -DestinationPath $ZipFile -Force

Write-Host "--- 2. Uploading to Google Cloud ---" -ForegroundColor Cyan
gcloud compute scp $ZipFile "${User}@${InstanceName}:${RemoteDir}/" --project=$ProjectID --zone=$Zone
gcloud compute scp "scripts/remote_deploy.sh" "${User}@${InstanceName}:${RemoteDir}/" --project=$ProjectID --zone=$Zone

Write-Host "--- 3. Executing Remote Deployment ---" -ForegroundColor Cyan
gcloud compute ssh "$User@$InstanceName" --project=$ProjectID --zone=$Zone --command="chmod +x $RemoteDir/remote_deploy.sh && $RemoteDir/remote_deploy.sh"

Write-Host "--- Deployment Finished! ---" -ForegroundColor Green
Write-Host "Visit https://anita-psy.online to verify."
