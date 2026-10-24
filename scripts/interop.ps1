$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$localDotnet = Join-Path $projectRoot '.tools/dotnet/dotnet.exe'
$dotnetCommand = if (Test-Path -LiteralPath $localDotnet) { $localDotnet } else { 'dotnet' }
$env:CAPTUREPROOF_INTEROP_DIR = Join-Path $projectRoot '.data/interop'
$env:CAPTUREPROOF_RESTORE_INTEROP_DIR = Join-Path $projectRoot '.data/restore-interop'
& $dotnetCommand test CaptureProof.slnx --no-restore
if ($LASTEXITCODE -ne 0) { throw 'Tests .NET échoués.' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Tests TypeScript échoués.' }
