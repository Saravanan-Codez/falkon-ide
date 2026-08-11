# Upstream VS Code Update & Release Sync Workflow

This document defines the official branch strategy and workflow for incorporating upstream VS Code updates from `microsoft/vscode`.

## Branch Strategy

- **`dev-updates`**: Isolated branch used to fetch and integrate upstream release tags/commits from `microsoft/vscode`.
- **`dev`**: Active integration branch where pull requests from `dev-updates` are tested and validated.
- **`main`**: Stable production release branch.

## Update Workflow Steps

### 1. Fetch & Merge Upstream
Run the automated sync tool:
```bash
npm run sync-upstream [optional-tag-or-branch]
```
*Example: `npm run sync-upstream 1.133.0`*

This script automatically:
1. Adds `https://github.com/microsoft/vscode.git` as `upstream` remote if not present.
2. Checks out or creates the `dev-updates` branch.
3. Merges the upstream release into `dev-updates`.
4. Executes `npm install`, `npm run bundle-vs`, and `cargo check --manifest-path src-tauri/Cargo.toml`.

### 2. Pull Request to `dev`
Once `dev-updates` passes local builds:
1. Push `dev-updates`: `git push origin dev-updates`
2. Create a Pull Request targeting the **`dev`** branch.
3. Perform battle-testing in the PR environment.

### 3. Promotion to `main`
Once testing on `dev` succeeds, create a PR or merge `dev` -> **`main`**.
