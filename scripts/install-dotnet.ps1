$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolDirectory = Join-Path $projectRoot '.tools/dotnet'
$installerPath = Join-Path $env:TEMP 'captureproof-dotnet-install.ps1'
Invoke-WebRequest 'https://dot.net/v1/dotnet-install.ps1' -OutFile $installerPath
& $installerPath -Version '10.0.402' -InstallDir $toolDirectory -NoPath
if ($LASTEXITCODE -ne 0) { throw 'Installation .NET échouée.' }
& (Join-Path $toolDirectory 'dotnet.exe') --info
