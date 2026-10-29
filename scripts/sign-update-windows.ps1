param(
    [Parameter(Mandatory=$true)][string]$Bundle,
    [Parameter(Mandatory=$true)][long]$Sequence,
    [Parameter(Mandatory=$true)][string]$MinimumKernelVersion,
    [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$privateFile = Join-Path $projectRoot '.localdata/release-signing/private-key.dpapi'
$secureKey = ConvertTo-SecureString -String ([IO.File]::ReadAllText($privateFile))
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $plaintextKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    $plaintextKey | & node (Join-Path $PSScriptRoot 'sign-update.mjs') $Bundle - $Sequence $MinimumKernelVersion $OutputDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Signed-update preparation failed.' }
} finally {
    $plaintextKey = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
}
