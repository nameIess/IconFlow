[CmdletBinding()]
param(
    [ValidateRange(1, 100)]
    [int] $KeepVersions = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot 'docker/compose.yaml'
$imageNames = @('iconflow-web', 'iconflow-resolver')

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI was not found. Install/start Docker Desktop and try again.'
}
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "Compose file not found: $composeFile"
}

Push-Location $repoRoot
try {
    Write-Host 'Building Compose images...'
    & docker compose -f $composeFile build --pull
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose build failed with exit code $LASTEXITCODE."
    }

    # Confirm both stable Compose build tags exist before creating release tags.
    foreach ($imageName in $imageNames) {
        & docker image inspect "$($imageName):ci" *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "Expected image $($imageName):ci was not produced by the Compose build."
        }
    }

    # Pick the next version above every existing version tag, keeping both images in sync.
    $existingImageRefs = @(& docker image ls --format '{{.Repository}}:{{.Tag}}')
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not list local Docker images.'
    }

    $versionNumbers = @(
        foreach ($imageRef in $existingImageRefs) {
            foreach ($imageName in $imageNames) {
                if ($imageRef -match ('^' + [regex]::Escape($imageName) + ':v(?<version>\d+)$')) {
                    [int] $Matches.version
                }
            }
        }
    )

    $currentMax = 0
    if ($versionNumbers.Count -gt 0) {
        $currentMax = ($versionNumbers | Measure-Object -Maximum).Maximum
    }
    $nextVersion = $currentMax + 1
    $versionTag = "v$nextVersion"

    foreach ($imageName in $imageNames) {
        & docker image tag "$($imageName):ci" "$($imageName):$versionTag"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to tag $($imageName):$versionTag."
        }

        & docker image tag "$($imageName):ci" "$($imageName):latest"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to update $($imageName):latest."
        }
    }

    Write-Host "Created local release tags: $versionTag and latest"

    # Keep the newest N numbered tags for each image. Never remove :ci or :latest.
    foreach ($imageName in $imageNames) {
        $tagRefs = @(& docker image ls --format '{{.Repository}}:{{.Tag}}' $imageName)
        if ($LASTEXITCODE -ne 0) {
            throw "Could not list tags for $imageName."
        }

        $imageVersions = @(
            foreach ($tagRef in $tagRefs) {
                if ($tagRef -match ('^' + [regex]::Escape($imageName) + ':v(?<version>\d+)$')) {
                    [int] $Matches.version
                }
            }
        ) | Sort-Object -Unique -Descending

        $oldVersions = @($imageVersions | Select-Object -Skip $KeepVersions | Sort-Object)
        foreach ($oldVersion in $oldVersions) {
            & docker image rm "$($imageName):v$oldVersion"
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to remove old tag $($imageName):v$oldVersion."
            }
        }
    }

    Write-Host ''
    Write-Host 'Current release tags:'
    foreach ($imageName in $imageNames) {
        Write-Host $imageName
        & docker image ls $imageName
        if ($LASTEXITCODE -ne 0) {
            throw "Could not display tags for $imageName."
        }
    }

    Write-Host "Done. Kept the newest $KeepVersions numbered version(s) per image, plus :ci and :latest."
}
finally {
    Pop-Location
}
