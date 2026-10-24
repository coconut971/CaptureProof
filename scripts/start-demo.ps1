param([string]$ListenUrl = 'http://localhost:5080')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$localDotnet = Join-Path $projectRoot '.tools/dotnet/dotnet.exe'
$dotnetCommand = if (Test-Path -LiteralPath $localDotnet) { $localDotnet } else { 'dotnet' }
if (-not $env:ASPNETCORE_ENVIRONMENT) { $env:ASPNETCORE_ENVIRONMENT = 'Development' }
if (-not $env:CaptureProof__DataDirectory) { $env:CaptureProof__DataDirectory = Join-Path $projectRoot '.data/demo' }
$env:ASPNETCORE_URLS = $ListenUrl
& $dotnetCommand run --no-launch-profile --project src/CaptureProof.Api
exit $LASTEXITCODE
