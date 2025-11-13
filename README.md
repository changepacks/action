# Changepacks Action

GitHub Action for automating changepacks version management, PR creation, and release publishing.

## Overview

This action automates the changepacks workflow by:
1. Installing changepacks
2. Running `changepacks check --format json`
3. Updating PR comments with changepack information
4. Creating version update PRs when changepacks are detected
5. Creating releases when changepacks are ready to publish

## Features

- ✅ Automatic changepacks installation
- ✅ PR comment updates with changepack information
- ✅ Automatic PR creation for version updates
- ✅ Automatic release creation with tags
- ✅ Support for multiple packages in a monorepo
- ✅ Past changepack detection and rollback

## Usage

### Basic Setup

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  changepacks:
    name: changepacks
    runs-on: ubuntu-latest
    permissions:
      # Create pull request comments
      pull-requests: write
      # Create branches and pull requests
      contents: write
    steps:
      - uses: actions/checkout@v5
      - uses: changepacks/action@main
        id: changepacks
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          create_release: true
    outputs:
      changepacks: ${{ steps.changepacks.outputs.changepacks }}
      release_assets_urls: ${{ steps.changepacks.outputs.release_assets_urls }}
```

### Using Outputs

You can use the outputs to conditionally run other jobs:

```yaml
jobs:
  changepacks:
    name: changepacks
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: write
    steps:
      - uses: actions/checkout@v5
      - uses: changepacks/action@main
        id: changepacks
    outputs:
      changepacks: ${{ steps.changepacks.outputs.changepacks }}
      release_assets_urls: ${{ steps.changepacks.outputs.release_assets_urls }}

  # Build only if specific package changed
  node-build:
    needs: changepacks
    if: ${{ contains(needs.changepacks.outputs.changepacks, 'bridge/node/package.json') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Build
        run: echo "Building node package..."
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `token` | GitHub token for API operations | Yes | `${{ github.token }}` |
| `create_release` | Whether to create releases when changepacks are ready | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `changepacks` | JSON array of changed project paths (e.g., `["bridge/node/package.json"]`) |
| `release_assets_urls` | JSON object mapping project paths to release asset upload URLs |

## How It Works

### 1. Pull Request Workflow

When the action runs on a pull request:
- Installs changepacks
- Runs `changepacks check --format json`
- Updates or creates a PR comment with changepack information

### 2. Push to Base Branch Workflow

When the action runs on a push to the base branch:

#### If changepacks have `nextVersion`:
- Creates or updates a branch `changepacks/{baseBranch}`
- Runs `changepacks update` to update version files
- Removes changepacks binary from git
- Commits changes with message "Update Versions"
- Creates or updates a pull request titled "Update Versions"

#### If changepacks are empty:
- Checks past commits for changepack changes
- If past changepacks exist, rolls back `.changepacks/` folder and checks again
- If changepacks are found, creates releases with tags
- Tag format: `{packageName}({path})@{version}`

### 3. Release Creation

When creating releases:
- Creates a git tag for each package with a new version
- Creates a GitHub release with changelog body
- Sets the latest release based on `latestPackage` config
- Outputs release asset URLs for further processing

## Configuration

The action reads changepacks configuration from your repository. Make sure you have a `.changepacks/config.json` file with:

```json
{
  "ignore": ["path/to/ignore"],
  "baseBranch": "main",
  "latestPackage": "path/to/package.json"
}
```

## Permissions

The action requires the following permissions:

- `pull-requests: write` - To create and update PR comments
- `contents: write` - To create branches, commits, and pull requests

Make sure to set these in your workflow file:

```yaml
permissions:
  pull-requests: write
  contents: write
```

## Examples

### Conditional Build Jobs

```yaml
jobs:
  changepacks:
    # ... changepacks job ...

  build-package-a:
    needs: changepacks
    if: ${{ contains(needs.changepacks.outputs.changepacks, 'packages/a/package.json') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Build Package A
        run: npm run build --workspace=packages/a

  build-package-b:
    needs: changepacks
    if: ${{ contains(needs.changepacks.outputs.changepacks, 'packages/b/package.json') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Build Package B
        run: npm run build --workspace=packages/b
```

### Disable Release Creation

```yaml
- uses: changepacks/action@main
  with:
    create_release: false
```

## License

Apache-2.0

## Author

JeongMin Oh
