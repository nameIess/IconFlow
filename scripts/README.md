# Local Docker image releases

Run the PowerShell release script from the repository root:

```powershell
.\scripts\docker-release.ps1
```

The script builds the two images defined in docker/compose.yaml, then tags them with the next shared numbered version and latest:

- iconflow-web:vN and iconflow-resolver:vN
- iconflow-web:latest and iconflow-resolver:latest

It retains the newest five numbered tags per image by default. Override that count when needed:

```powershell
.\scripts\docker-release.ps1 -KeepVersions 3
```

The existing :ci tags are preserved because Compose uses them for local builds and runs. The script only changes local Docker image tags; it does not push images to a registry, edit Compose/YAML files, or create Git commits.

latest is a mutable tag and always points at the most recent release produced by this script. Use a numbered tag such as :v7 when you need a specific rollback target.

Run this script from a PowerShell session with Docker Desktop running. The first run may take longer while Docker downloads base images and build dependencies.
