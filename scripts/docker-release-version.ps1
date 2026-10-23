function ConvertTo-DockerReleaseTag {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string] $Version
    )

    # Docker tags cannot contain SemVer build metadata (+build).
    $pattern = '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$'
    $normalized = $Version.Trim()
    if ($normalized.StartsWith('v')) { $normalized = $normalized.Substring(1) }
    if ($normalized -notmatch $pattern) {
        throw "Invalid release version '$normalized'. Use MAJOR.MINOR.PATCH with optional SemVer prerelease, e.g. 3.1.0 or 3.1.0-rc.1. Build metadata is not supported in Docker tags."
    }
    return $normalized
}
