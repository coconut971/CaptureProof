param(
    [Parameter(Mandatory = $true)][string]$Address,
    [ValidateRange(1024, 65535)][int]$Port = 7443
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$parsedAddress = $null
if (-not [Net.IPAddress]::TryParse($Address, [ref]$parsedAddress) -or $parsedAddress.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'Indiquez une adresse IPv4 locale valide.'
}
if (-not (Get-NetIPAddress -AddressFamily IPv4 | Where-Object IPAddress -eq $Address)) {
    throw 'Cette adresse IPv4 ne correspond pas au PC.'
}
$tlsDirectory = Join-Path $projectRoot '.data/tls'
$certificatePath = Join-Path $tlsDirectory 'cert.pem'
$keyPath = Join-Path $tlsDirectory 'key.pem'
if (-not (Test-Path -LiteralPath $certificatePath) -or -not (Test-Path -LiteralPath $keyPath)) {
    throw 'Certificat TLS absent. Suivre docs/https.md avant le lancement.'
}
$localDotnet = Join-Path $projectRoot '.tools/dotnet/dotnet.exe'
$dotnetCommand = if (Test-Path -LiteralPath $localDotnet) { $localDotnet } else { 'dotnet' }
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:AllowedHosts = "$Address;localhost;127.0.0.1"
$env:CaptureProof__PublicOrigin = "https://${Address}:$Port"
if (-not $env:CaptureProof__DataDirectory) { $env:CaptureProof__DataDirectory = Join-Path $projectRoot '.data/demo' }
$env:Kestrel__Endpoints__Https__Url = "https://${Address}:$Port"
$env:Kestrel__Endpoints__Https__Certificate__Path = $certificatePath
$env:Kestrel__Endpoints__Https__Certificate__KeyPath = $keyPath
Write-Host "CaptureProof : $($env:CaptureProof__PublicOrigin)"
& $dotnetCommand run --no-launch-profile --project src/CaptureProof.Api
exit $LASTEXITCODE
