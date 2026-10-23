$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'docker-release-version.ps1')

$validCases = @{
    '3.1.0' = '3.1.0'
    'v3.1.0' = '3.1.0'
    '3.1.0-rc.1' = '3.1.0-rc.1'
    '0.0.0' = '0.0.0'
}
foreach ($entry in $validCases.GetEnumerator()) {
    if ($entry.Value -eq $null) { continue }
    $actual = ConvertTo-DockerReleaseTag -Version $entry.Key
    if ($actual -cne $entry.Value) { throw "Expected '$($entry.Value)' for '$($entry.Key)', got '$actual'." }
}

$invalidCases = @('', '1', '1.2', '01.2.3', '1.2.3+build', '1.2.3-01', '1.2.3-rc..1', 'v')
foreach ($candidate in $invalidCases) {
    $rejected = $false
    try { $null = ConvertTo-DockerReleaseTag -Version $candidate }
    catch {
        if ($_.Exception.Message -like 'Invalid release version*') { $rejected = $true }
        else { throw }
    }
    if (-not $rejected) { throw "Invalid release version was accepted: '$candidate'." }
}
Write-Host 'Docker release version tests passed.'
