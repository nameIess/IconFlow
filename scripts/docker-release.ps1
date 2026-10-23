[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Version,
    [switch] $UpdateLatest
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Docker tags cannot contain SemVer build metadata (+build).
$semVerPattern = '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$'
$Version = $Version.Trim()
if ($Version.StartsWith('v')) { $Version = $Version.Substring(1) }
if ($Version -notmatch $semVerPattern) {
    throw "Invalid release version '$Version'. Use MAJOR.MINOR.PATCH with optional SemVer prerelease, e.g. 3.1.0 or 3.1.0-rc.1. Build metadata is not supported in Docker tags."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot 'docker/compose.yaml'
$imageNames = @('iconflow-web', 'iconflow-resolver')
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI was not found. Install/start Docker Desktop and try again.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git CLI was not found. Install Git and try again.' }
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) { throw "Compose file not found: $composeFile" }

Push-Location $repoRoot
try {
    $commitSha = (& git rev-parse --verify HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $commitSha -notmatch '^[0-9a-f]{40}$') {
        throw 'Could not resolve the current Git commit. Run this script inside a Git checkout.'
    }
    $shortSha = $commitSha.Substring(0, 12)
    $versionTag = $Version
    $shaTag = "sha-$shortSha"

    # Never overwrite a local release tag silently. Registry-wide checks require a configured registry.
    foreach ($imageName in $imageNames) {
        & docker image inspect "$($imageName):$versionTag" *> $null
        if ($LASTEXITCODE -eq 0) {
            throw "Release tag $($imageName):$versionTag already exists locally. Choose a new version; existing release tags are not overwritten."
        }
    }

    Write-Host 'Validating Compose configuration...'
    & docker compose -f $composeFile config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration validation failed.' }

    Write-Host 'Building Compose images with refreshed base-image tags...'
    & docker compose -f $composeFile build --pull
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose build failed with exit code $LASTEXITCODE." }

    foreach ($imageName in $imageNames) {
        & docker image inspect "$($imageName):ci" *> $null
        if ($LASTEXITCODE -ne 0) { throw "Expected image $($imageName):ci was not produced by the Compose build." }
    }

    foreach ($imageName in $imageNames) {
        foreach ($tag in @($versionTag, $shaTag)) {
            & docker image tag "$($imageName):ci" "$($imageName):$tag"
            if ($LASTEXITCODE -ne 0) { throw "Failed to tag $($imageName):$tag." }
        }
        if ($UpdateLatest) {
            & docker image tag "$($imageName):ci" "$($imageName):latest"
            if ($LASTEXITCODE -ne 0) { throw "Failed to update $($imageName):latest." }
        }
    }

    Write-Host "Created local release tags for version $Version at commit $shortSha."
    foreach ($imageName in $imageNames) {
        & docker image ls $imageName
        if ($LASTEXITCODE -ne 0) { throw "Could not display tags for $imageName." }
    }
    if ($UpdateLatest) { Write-Host ':latest was updated (mutable convenience tag; do not use it as a rollback reference).' }
    Write-Host 'No images were pushed. This script only tags local images; it does not guarantee registry-wide uniqueness.'
}
finally { Pop-Location }
