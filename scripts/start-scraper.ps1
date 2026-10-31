$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectPath
try {
    & docker info --format '{{.ServerVersion}}'
    if ($LASTEXITCODE -ne 0) { throw 'Open Docker Desktop and wait for the engine to start, then run this script again.' }
    & docker compose version 2>$null
    if ($LASTEXITCODE -eq 0) {
        & docker compose up -d
    } else {
        $composePath = Join-Path $env:ProgramFiles 'Docker\Docker\resources\cli-plugins\docker-compose.exe'
        if (!(Test-Path -LiteralPath $composePath)) { throw 'Docker Compose is missing. Install or repair Docker Desktop.' }
        & $composePath up -d
    }
    if ($LASTEXITCODE -ne 0) { throw 'Scraper startup failed. Check Docker output above.' }
    Write-Host 'Scraper started. Browser setup may take a few minutes. In LeadsNoble, open Discover > Check scraper connection.'
} finally { Pop-Location }
