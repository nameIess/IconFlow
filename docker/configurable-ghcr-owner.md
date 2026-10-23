# Configurable GHCR Owner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GHCR owner configurable for local Docker Compose and GitHub Actions, then document and verify the version-tagged publish flow.

**Architecture:** Docker Compose will resolve both service image names from `GHCR_OWNER`, defaulting to `nameIess`. GitHub Actions will export the lowercase repository owner as `GHCR_OWNER`, so Compose builds, Trivy scans, release tags, and pushes all reference the same images. The local PowerShell release helper will use the same owner variable and default.

**Tech Stack:** Docker Compose, Dockerfiles, GitHub Actions YAML, PowerShell, Markdown documentation.

---

### Task 1: Parameterize Compose image names

**Files:**

- Modify: `docker/compose.yaml:2-36`

- [ ] **Step 1: Replace the hard-coded owner in both service image names**

Change the `web` and `resolver` image values to:

```yaml
image: ghcr.io/${GHCR_OWNER:-nameIess}/iconflow-web:${IMAGE_TAG:-latest}
```

and:

```yaml
image: ghcr.io/${GHCR_OWNER:-nameIess}/iconflow-resolver:${IMAGE_TAG:-latest}
```

Do not change ports, health checks, security options, resource limits, or build contexts.

- [ ] **Step 2: Validate default and overridden interpolation**

Run from `D:\nameIess\IconFlow`:

```powershell
docker compose -f docker/compose.yaml config --quiet
$env:GHCR_OWNER = "exampleuser"
docker compose -f docker/compose.yaml config | Select-String "ghcr.io/exampleuser/"
Remove-Item Env:GHCR_OWNER
```

Expected: configuration validation succeeds and the filtered output contains both `ghcr.io/exampleuser/iconflow-web` and `ghcr.io/exampleuser/iconflow-resolver`.

- [ ] **Step 3: Commit the Compose change**

```powershell
git add docker/compose.yaml
git commit -m "feat: parameterize GHCR image owner"
```

### Task 2: Align GitHub Actions with the configurable owner

**Files:**

- Modify: `.github/workflows/docker.yml:48-106`

- [ ] **Step 1: Export the repository owner for Compose**

Add a step before `Validate Compose configuration`. Give it `id: ghcr-owner`
so later action inputs can consume the normalized value:

```yaml
- name: Set GHCR owner
  id: ghcr-owner
  shell: bash
  run: |
    owner="$(printf '%s' "$GITHUB_REPOSITORY_OWNER" | tr '[:upper:]' '[:lower:]')"
    echo "GHCR_OWNER=$owner" >> "$GITHUB_ENV"
    echo "value=$owner" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 2: Use the resolved owner for Trivy scans**

Replace both hard-coded Trivy image references with expressions that consume the
step output:

```yaml
image-ref: ghcr.io/${{ steps.ghcr-owner.outputs.value }}/iconflow-web:ci
```

and:

```yaml
image-ref: ghcr.io/${{ steps.ghcr-owner.outputs.value }}/iconflow-resolver:ci
```

- [ ] **Step 3: Verify the release tag and publish loops match Compose**

Keep the existing `owner="$(... GITHUB_REPOSITORY_OWNER ...)"` normalization in the shell steps and verify that every image in the tagging and publishing arrays is:

```bash
ghcr.io/$owner/iconflow-web
ghcr.io/$owner/iconflow-resolver
```

The build must produce `ghcr.io/$owner/...:ci`, and the release steps must tag
and push those same images.

- [ ] **Step 4: Validate workflow syntax and commit**

Run:

```powershell
docker compose -f docker/compose.yaml config --quiet
git diff --check
git add .github/workflows/docker.yml
git commit -m "ci: align Docker publishing with GHCR owner"
```

Expected: Compose validation and whitespace checks pass.

### Task 3: Parameterize the local release helper

**Files:**

- Modify: `scripts/docker-release.ps1:10-15`
- Modify: `scripts/README.md:1-20`

- [ ] **Step 1: Derive a configurable lowercase owner**

In `scripts/docker-release.ps1`, define the owner after the repository root is resolved:

```powershell
$ghcrOwner = if ([string]::IsNullOrWhiteSpace($env:GHCR_OWNER)) {
    'nameIess'
} else {
    $env:GHCR_OWNER.ToLowerInvariant()
}
$imageNames = @("ghcr.io/$ghcrOwner/iconflow-web", "ghcr.io/$ghcrOwner/iconflow-resolver")
```

Replace the existing hard-coded `$imageNames` assignment. Preserve the existing validation, tag collision checks, build behavior, and cleanup of `IMAGE_TAG`.

- [ ] **Step 2: Document the override and release command**

Add a PowerShell example to `scripts/README.md`:

```powershell
$env:GHCR_OWNER = "your-github-username"
.\scripts\docker-release.ps1 -Version 1.0.0
```

Explain that this only builds and tags local images; it does not push to GHCR. The GitHub Actions release workflow publishes images when an annotated `v1.0.0` tag is pushed.

- [ ] **Step 3: Validate the PowerShell script syntax**

Run:

```powershell
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  "scripts/docker-release.ps1",
  [ref]$tokens,
  [ref]$errors
)
if ($errors.Count -ne 0) { $errors | Format-List; exit 1 }
```

Expected: no parser errors.

- [ ] **Step 4: Commit the helper and documentation**

```powershell
git add scripts/docker-release.ps1 scripts/README.md
git commit -m "docs: document configurable GHCR releases"
```

### Task 4: Document the end-to-end GHCR publish flow

**Files:**

- Modify: `README.md` in the Docker and production release sections

- [ ] **Step 1: Document local owner override**

Add a PowerShell example showing that the default owner is `nameIess` and that local users can override it:

```powershell
$env:GHCR_OWNER = "your-github-username"
docker compose -f docker/compose.yaml build --pull
```

- [ ] **Step 2: Document tag creation and push**

Add the exact release commands:

```powershell
git checkout master
git pull origin master
git tag -a v1.0.0 -m "IconFlow Docker release 1.0.0"
git push origin v1.0.0
```

State that the Docker workflow validates, scans, smoke-tests, and publishes `ghcr.io/<lowercase-owner>/iconflow-web:1.0.0` and `ghcr.io/<lowercase-owner>/iconflow-resolver:1.0.0`, plus stable aliases for non-prerelease versions.

- [ ] **Step 3: Document pulling a published version**

Add:

```powershell
$env:GHCR_OWNER = "your-github-username"
$env:IMAGE_TAG = "1.0.0"
docker compose -f docker/compose.yaml pull
docker compose -f docker/compose.yaml up -d
```

Explain that private packages require `docker login ghcr.io` with a GitHub token having package read permission, and that an immutable version tag is preferred over `latest`.

- [ ] **Step 4: Commit documentation**

```powershell
git add README.md
git commit -m "docs: explain GHCR package publishing"
```

### Task 5: Run focused validation

**Files:**

- Verify: `docker/compose.yaml`
- Verify: `.github/workflows/docker.yml`
- Verify: `scripts/docker-release.ps1`
- Verify: `README.md`

- [ ] **Step 1: Validate Compose with the repository default owner**

Run:

```powershell
Remove-Item Env:GHCR_OWNER -ErrorAction SilentlyContinue
docker compose -f docker/compose.yaml config
```

Expected: both images resolve to `ghcr.io/nameIess/...` and the command exits successfully.

- [ ] **Step 2: Validate Compose with a custom owner**

Run:

```powershell
$env:GHCR_OWNER = "exampleuser"
docker compose -f docker/compose.yaml config
```

Expected: both images resolve to `ghcr.io/exampleuser/...`.

- [ ] **Step 3: Build the images**

Run:

```powershell
docker compose -f docker/compose.yaml build --pull
```

Expected: both `web` and `resolver` images build successfully and are tagged with the resolved `GHCR_OWNER` and `IMAGE_TAG`.

- [ ] **Step 4: Run the container smoke checks**

Run:

```powershell
docker compose -f docker/compose.yaml up --detach --wait --wait-timeout 90
curl.exe --fail http://127.0.0.1:8080/
curl.exe --fail http://127.0.0.1:8080/healthz
docker compose -f docker/compose.yaml down --volumes --remove-orphans
```

Expected: the frontend and health endpoint return successfully, and Compose shuts down cleanly.

- [ ] **Step 5: Review the final diff**

Run:

```powershell
git diff HEAD~4..HEAD --check
git status --short
```

Expected: no whitespace errors and no unexpected uncommitted files.
