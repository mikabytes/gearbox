# Repository guidance

## Hosting

- The canonical repository is hosted on GitHub at `github.com/mikabytes/gearbox`.
- Use GitHub issues and pull requests, and use the `gh` CLI for forge operations.
- The `origin` remote is the source of truth for branches and version tags.

## Publishing a release

Releases must be performed in this order:

1. Bump the version in `package.json` and make any release-note updates.
2. Run the full test suite and verify the package contents with `npm pack --dry-run`.
3. Commit the release changes and push `main` to `origin`.
4. Publish the `gearbox-torrent` package to npm. For prereleases, use the matching npm dist-tag, for example `npm publish --tag alpha`.
5. Create the matching Git tag using the `v<version>` format, for example `v1.0.0-alpha.2`, and push that tag to `origin`.

Pushing the version tag triggers the GitHub Actions workflows, including the container build and publication to GitHub Container Registry. Do not push the version tag before the npm package has been published successfully.
