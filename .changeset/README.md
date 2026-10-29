# Changesets

Hello and welcome! This folder has been setup by `@changesets/cli` to help manage versions and releases of `a2ui-miniprogram`.

## Adding a changeset

To record a changeset for your contribution, run:

```bash
npm run changeset
```

Follow the prompts to specify the bump type (`patch`, `minor`, or `major`) and describe the changes made.

## Releasing a new version

```bash
# Bumps versions in package.json and updates CHANGELOG.md
npm run version-packages

# Publishes packages to npm
npm run release
```
