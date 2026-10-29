param([switch]$ConfigureGitHub)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$publicFile = Join-Path $projectRoot 'release-public-key.pem'
$privateDirectory = Join-Path $projectRoot '.localdata/release-signing'
$privateFile = Join-Path $privateDirectory 'private-key.dpapi'
if (Test-Path -LiteralPath $publicFile) { throw 'A trust root already exists. Key rotation requires a separate reviewed migration.' }
if (Test-Path -LiteralPath $privateFile) { throw 'A private key already exists. Preserve the signing identity.' }
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Run this maintainer setup with Node available. No key was created.' }
# Private material stays in process memory and a current-user DPAPI envelope.
$keyJson = & $node -e 'const c=require("node:crypto");const k=c.generateKeyPairSync("ed25519");process.stdout.write(JSON.stringify({public:k.publicKey.export({type:"spki",format:"pem"}),private:k.privateKey.export({type:"pkcs8",format:"pem"})}));'
if ($LASTEXITCODE -ne 0) { throw 'Key generation failed.' }
$keyMaterial = $keyJson | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $privateDirectory | Out-Null
$secureKey = ConvertTo-SecureString -String $keyMaterial.private -AsPlainText -Force
$encrypted = ConvertFrom-SecureString -SecureString $secureKey
[IO.File]::WriteAllText($privateFile, $encrypted)
[IO.File]::WriteAllText($publicFile, $keyMaterial.public)
if ($ConfigureGitHub) {
    $keyMaterial.private | & gh secret set AGCU_RELEASE_SIGNING_KEY --repo shayann07/antigravity-computer-use
    if ($LASTEXITCODE -ne 0) { throw 'Local protected key retained; GitHub secret configuration failed.' }
}
$keyMaterial = $null
$keyJson = $null
Write-Output 'Created public trust root and DPAPI-protected private key. No release published.'
