**English** | [Français](fr/https.md)

# First HTTPS test on desktop, iPhone and Android

This procedure gives all three devices a common origin. User-reported flows have been completed on iPhone with Safari and on a Xiaomi with Mi Browser, including Wi-Fi recovery and a ten-second screen lock with a pending photo. Results, unchecked conditions and unknown versions are recorded in the [physical-device checklist](testing.md). Chrome Android remains untested on a physical device. Certificate installation and trust configuration on the Xiaomi were not recorded. Loopback HTTPS and fake cameras in automated tests do not replace device-specific checks. Do not disable TLS or browser protections.

Prerequisites: the same private local network, a stable LAN address for the desktop, the Node and .NET versions listed in the README, and [mkcert](https://github.com/FiloSottile/mkcert) installed according to its documentation. The example address below is `192.168.1.20`; replace it with the desktop's address. No tunnel is created automatically.

1. Build the demo with `npm ci`, then `npm run build`.
2. From the repository root in PowerShell, create a local development authority and a certificate containing the names you will actually use:

```powershell
mkcert -install
New-Item -ItemType Directory -Force .data/tls | Out-Null
mkcert -cert-file .data/tls/cert.pem -key-file .data/tls/key.pem 192.168.1.20 localhost 127.0.0.1
mkcert -CAROOT
```

3. Privately transfer and install **only the `rootCA.pem` root certificate** from that directory on the test phones. On iPhone, install the profile, then explicitly enable full trust under Settings, General, About, Certificate Trust Settings. On Android, install it as a user CA certificate in the security settings; the path depends on the manufacturer. Never copy `rootCA-key.pem`, the server private key or a signing key. This authority is for controlled test devices; remove it after testing when it is no longer needed.
4. Configure direct HTTPS on the server. Certificate paths must be absolute:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:AllowedHosts = '192.168.1.20;localhost;127.0.0.1'
$env:CaptureProof__PublicOrigin = 'https://192.168.1.20:7443'
$env:CaptureProof__DataDirectory = Join-Path (Get-Location) '.data/demo'
$env:Kestrel__Endpoints__Https__Url = 'https://0.0.0.0:7443'
$env:Kestrel__Endpoints__Https__Certificate__Path = Join-Path (Get-Location) '.data/tls/cert.pem'
$env:Kestrel__Endpoints__Https__Certificate__KeyPath = Join-Path (Get-Location) '.data/tls/key.pem'
.\.tools\dotnet\dotnet run --no-launch-profile --project src/CaptureProof.Api
```

Use `dotnet` instead of the local command if the required SDK is installed normally. Allow port 7443 only on the private network in the desktop firewall, following its local policy. The project does not change the firewall.

Once `.data/tls/cert.pem` and `.data/tls/key.pem` are prepared, the Windows script repeats the same startup:

```powershell
pwsh -File scripts/start-lan-https.ps1 -Address 192.168.1.20
```

The script checks that the address belongs to the desktop, selects the local SDK when available, preserves `.data/demo`, configures `PublicOrigin` and `AllowedHosts`, and starts Kestrel in Production with HTTPS bound to that address. It does not generate a certificate or change the firewall. If the desktop's IP address changes, regenerate the certificate with the new address and run the script again.

5. Open `https://192.168.1.20:7443` on the desktop and each phone. Check that the connection is trusted without a certificate warning. A LAN HTTP address cannot validate this mobile camera flow.
6. On the desktop, create a session. Scan its QR code on the phone, compare the six-digit codes, confirm the phone, then allow its camera. Capture, remove or retake photos and finalize. Check receipt on the desktop, download the originals and signed receipt, explicitly import trusted public keys into the verifier, and supply the expected business reference.
7. Open the HTTPS root directly on the phone and check that “Commencer la capture mobile” starts direct capture without creating a QR code.

On Linux, use the same settings with `export Kestrel__Endpoints__Https__...=...` and absolute paths. The built demo is served with the API; Vite is not involved in this test. The demo's current UI labels are French.

## Focused interruption test

Choose a physical-device test according to [the change being validated](testing.md#choosing-validations). For network loss or a screen lock, keep the same page open and do not reload it. Unsent JPEGs remain only in memory: closing the page or Android evicting it can lose them. Completed tests do not demonstrate preservation across a reload.

Receiving a first photo online provides a server-side baseline. A second photo captured offline should remain visible in the page; reconnect and use “Réessayer l’envoi” on that same photo. For a screen-lock test, check that the camera is stopped after returning to the page before explicitly restarting it. Finalize before the displayed deadline, then check the exact photo count, absence of duplicate uploads and receipt verification against the originals. Record user observations separately from hash and signature checks.

If an operator explicitly chooses a proxy or tunnel, `PublicOrigin` must be its external HTTPS origin. This version does not blindly enable forwarded headers: configure a trusted proxy or preserve HTTPS through to the backend. The proxy must preserve cookies and WebSocket and must not log bodies, cookies or secrets. No third-party account or paid service is required.
