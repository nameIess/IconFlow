[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Version,
    [switch] $UpdateLatest
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'docker-release-version.ps1')
$Version = ConvertTo-DockerReleaseTag -Version $Version

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot 'docker/compose.yaml'
$imageName = 'ghcr.io/nameiess/iconflow'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI was not found. Install/start Docker Desktop and try again.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git CLI was not found. Install Git and try again.' }
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) { throw "Compose file not found: $composeFile" }

Push-Location $repoRoot
$previousImageTag = $env:IMAGE_TAG
try {
    $commitSha = (& git rev-parse --verify HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $commitSha -notmatch '^[0-9a-f]{40}$') {
        throw 'Could not resolve the current Git commit. Run this script inside a Git checkout.'
    }
    $shortSha = $commitSha.Substring(0, 12)
    $versionTag = $Version
    $shaTag = "sha-$shortSha"

    # Never overwrite a local release tag silently. Registry-wide checks require a configured registry.
    foreach ($tag in @($versionTag, $shaTag)) {
        & docker image inspect "$($imageName):$tag" *> $null
        if ($LASTEXITCODE -eq 0) {
            throw "Release tag $($imageName):$tag already exists locally. Choose a new version or build from a new commit; existing release tags are not overwritten."
        }
    }

    $env:IMAGE_TAG = 'ci'
    Write-Host 'Validating Compose configuration...'
    & docker compose -f $composeFile config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration validation failed.' }

    Write-Host 'Building Compose images with refreshed base-image tags...'
    & docker compose -f $composeFile build --pull
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose build failed with exit code $LASTEXITCODE." }

    & docker image inspect "$($imageName):ci" *> $null
    if ($LASTEXITCODE -ne 0) { throw "Expected image $($imageName):ci was not produced by the Compose build." }

    foreach ($tag in @($versionTag, $shaTag)) {
        & docker image tag "$($imageName):ci" "$($imageName):$tag"
        if ($LASTEXITCODE -ne 0) { throw "Failed to tag $($imageName):$tag." }
    }
    if ($UpdateLatest) {
        & docker image tag "$($imageName):ci" "$($imageName):latest"
        if ($LASTEXITCODE -ne 0) { throw "Failed to update $($imageName):latest." }
    }

    Write-Host "Created local release tags for version $Version at commit $shortSha."
    & docker image ls $imageName
    if ($LASTEXITCODE -ne 0) { throw "Could not display tags for $imageName." }
    if ($UpdateLatest) { Write-Host ':latest was updated (mutable convenience tag; do not use it as a rollback reference).' }
    Write-Host 'No images were pushed. This script only tags local images; it does not guarantee registry-wide uniqueness.'
}
finally {
    if ($null -eq $previousImageTag) { Remove-Item Env:IMAGE_TAG -ErrorAction SilentlyContinue }
    else { $env:IMAGE_TAG = $previousImageTag }
    Pop-Location
}
