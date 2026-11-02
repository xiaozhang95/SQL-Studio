[CmdletBinding()]
param(
    [ValidateSet('windows', 'linux', 'darwin')]
    [string]$TargetOS,
    [ValidateSet('amd64', 'arm64')]
    [string]$TargetArch
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$frontendRoot = Join-Path $projectRoot 'sql-studio-frontend'
$backendRoot = Join-Path $projectRoot 'sql-studio-backend'
$webuiRoot = Join-Path $backendRoot 'internal\webui'
$embeddedDist = [System.IO.Path]::GetFullPath((Join-Path $webuiRoot 'dist'))
$releaseRoot = Join-Path $projectRoot 'release'

Get-Command pnpm -ErrorAction Stop | Out-Null
Get-Command go -ErrorAction Stop | Out-Null
if (-not $TargetOS) {
    $TargetOS = (& go env GOOS).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not determine GOOS.' }
}
if (-not $TargetArch) {
    $TargetArch = (& go env GOARCH).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not determine GOARCH.' }
}

Write-Host '[1/3] Installing frontend dependencies and building dist...'
Push-Location $frontendRoot
try {
    & pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed.' }
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally {
    Pop-Location
}

$frontendDist = Join-Path $frontendRoot 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $frontendDist 'index.html') -PathType Leaf)) {
    throw 'Frontend dist/index.html was not generated.'
}
Write-Host '[2/3] Refreshing embedded frontend assets...'
# Only this fixed generated directory may be removed; never follow a substituted junction.
if ($embeddedDist -ne [System.IO.Path]::GetFullPath((Join-Path $backendRoot 'internal\webui\dist'))) {
    throw 'Embedded asset directory is outside the expected workspace location.'
}
foreach ($assetPath in @($webuiRoot, $embeddedDist)) {
    if ((Test-Path -LiteralPath $assetPath) -and
        ((Get-Item -LiteralPath $assetPath -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        throw "Refusing to replace linked asset directory: $assetPath"
    }
}
if (Test-Path -LiteralPath $embeddedDist) {
    Remove-Item -LiteralPath $embeddedDist -Recurse -Force
}
New-Item -ItemType Directory -Path $embeddedDist -Force | Out-Null
Get-ChildItem -LiteralPath $frontendDist -Force | Copy-Item -Destination $embeddedDist -Recurse -Force
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
$suffix = if ($TargetOS -eq 'windows') { '.exe' } else { '' }
$outputFile = Join-Path $releaseRoot "sql-studio-$TargetOS-$TargetArch$suffix"

Write-Host "[3/3] Building standalone executable ($TargetOS/$TargetArch)..."
$previousGOOS = $env:GOOS
$previousGOARCH = $env:GOARCH
$previousCGO = $env:CGO_ENABLED
Push-Location $backendRoot
try {
    $env:GOOS = $TargetOS
    $env:GOARCH = $TargetArch
    $env:CGO_ENABLED = '0'
    & go build -tags embedded -trimpath -ldflags '-s -w' -o $outputFile main.go
    if ($LASTEXITCODE -ne 0) { throw 'Go build failed.' }
} finally {
    $env:GOOS = $previousGOOS
    $env:GOARCH = $previousGOARCH
    $env:CGO_ENABLED = $previousCGO
    Pop-Location
}
Write-Host "Built: $outputFile"
Write-Host 'Run the executable, then open http://127.0.0.1:8080/ . No external dist is needed.'
