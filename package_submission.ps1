# package_submission.ps1
# PowerShell script to package the microservices codebase and documentation for BITS Pilani submission.

$ErrorActionPreference = "Stop"

Write-Host "=== Snabbit Microservices Assignment Packager ===" -ForegroundColor Cyan

# Prompt user for BITS IDs if not pre-defined
if (-not $bitsIds) {
    $bitsIds = Read-Host "Please enter BITS IDs of team members separated by underscores (e.g., 2021AD04001_2021AD04002)"
}
if ([string]::IsNullOrWhiteSpace($bitsIds)) {
    $bitsIds = "BITS_Group_Members"
    Write-Host "No BITS IDs entered. Defaulting to '$bitsIds'." -ForegroundColor Yellow
}

$appName = "snabbit"
$zipFileName = "${bitsIds}_${appName}.zip"
$downloadsFolder = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("UserProfile"), "Downloads")
$destZipPath = Join-Path $downloadsFolder $zipFileName

$projectRoot = $PSScriptRoot
$tempFolder = Join-Path $projectRoot "submission_temp"

# Clean up existing temp folder or zip if any
if (Test-Path $tempFolder) { Remove-Item -Recurse -Force $tempFolder }
if (Test-Path $destZipPath) {
    Remove-Item -Force $destZipPath
    Write-Host "Removed existing zip file at $destZipPath" -ForegroundColor Yellow
}

# Create temp folder structure
New-Item -ItemType Directory -Path $tempFolder | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempFolder "customer-service") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempFolder "expert-service") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempFolder "booking-service") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempFolder "api-gateway") | Out-Null

Write-Host "`nCopying codebase..." -ForegroundColor Yellow

# Copy Customer Service files (excluding node_modules and databases)
Copy-Item (Join-Path $projectRoot "customer-service/package.json") (Join-Path $tempFolder "customer-service/")
Copy-Item (Join-Path $projectRoot "customer-service/Dockerfile") (Join-Path $tempFolder "customer-service/")
Copy-Item -Recurse (Join-Path $projectRoot "customer-service/src") (Join-Path $tempFolder "customer-service/")

# Copy Expert Service files
Copy-Item (Join-Path $projectRoot "expert-service/package.json") (Join-Path $tempFolder "expert-service/")
Copy-Item (Join-Path $projectRoot "expert-service/Dockerfile") (Join-Path $tempFolder "expert-service/")
Copy-Item -Recurse (Join-Path $projectRoot "expert-service/src") (Join-Path $tempFolder "expert-service/")

# Copy Booking Service files
Copy-Item (Join-Path $projectRoot "booking-service/package.json") (Join-Path $tempFolder "booking-service/")
Copy-Item (Join-Path $projectRoot "booking-service/Dockerfile") (Join-Path $tempFolder "booking-service/")
Copy-Item -Recurse (Join-Path $projectRoot "booking-service/src") (Join-Path $tempFolder "booking-service/")

# Copy API Gateway files
Copy-Item (Join-Path $projectRoot "api-gateway/package.json") (Join-Path $tempFolder "api-gateway/")
Copy-Item (Join-Path $projectRoot "api-gateway/Dockerfile") (Join-Path $tempFolder "api-gateway/")
Copy-Item -Recurse (Join-Path $projectRoot "api-gateway/src") (Join-Path $tempFolder "api-gateway/")

# Copy root orchestration files and docs
Copy-Item (Join-Path $projectRoot "docker-compose.yml") $tempFolder
Copy-Item (Join-Path $projectRoot "README.md") $tempFolder
Copy-Item (Join-Path $projectRoot "test_apis.ps1") $tempFolder
if (Test-Path (Join-Path $projectRoot "test_apis.sh")) {
    Copy-Item (Join-Path $projectRoot "test_apis.sh") $tempFolder
}
if (Test-Path (Join-Path $projectRoot "Assignment_1_Report.html")) {
    Copy-Item (Join-Path $projectRoot "Assignment_1_Report.html") $tempFolder
}
if (Test-Path (Join-Path $projectRoot "test_execution_screenshot.png")) {
    Copy-Item (Join-Path $projectRoot "test_execution_screenshot.png") $tempFolder
}

Write-Host "Compressing archive to $destZipPath..." -ForegroundColor Yellow

# Create ZIP archive
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempFolder, $destZipPath)

# Clean up temp folder
Remove-Item -Recurse -Force $tempFolder

Write-Host "`n=== Packaging Complete! ===" -ForegroundColor Green
Write-Host "Successfully generated zip file: $zipFileName" -ForegroundColor Green
Write-Host "Saved directly to your Downloads folder: $destZipPath" -ForegroundColor Green
