# Contributing to a2ui-miniprogram

Thank you for your interest in contributing to **a2ui-miniprogram**! We welcome bug reports, feature requests, documentation improvements, and pull requests.

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful and constructive in all interactions.

## Development Workflow

### 1. Prerequisites
- Node.js 22.x or 24.x (>= 22.0.0)
- npm >= 10.0.0
- WeChat DevTools (微信开发者工具) for manual and automator testing

### 2. Getting Started
```bash
# Clone the repository
git clone https://github.com/lbb00/a2ui-miniprogram.git
cd a2ui-miniprogram

# Install dependencies
npm install

# Run the test suite
npm test
```

### 3. Architecture Overview
- `miniprogram/core/`: Platform-agnostic pure JavaScript engine, protocol parsers, and data model.
  - `engine.js`: A2UI state machine, component tree derivation, patch computation.
  - `data-model.js`: JSON Pointer addressing, expression evaluation, ReDoS protection.
  - `pointer.js`: Safe path resolution and prototype pollution prevention.
  - `markdown.js`: Safe markdown AST and rich-text converter.
- `miniprogram/components/`: WeChat MiniProgram native components.
  - `a2ui-surface/`: Top-level surface container and template dispatcher.
  - `a2ui-surface-layer/`: Level fallback trampoline component for nesting depth > 4.
- `scripts/generate-templates.js`: Compiler script generating `templates.wxml` from `tmpl_0` through `tmpl_4`.

### 4. Running Tests
```bash
# Run all unit tests, security tests, and official catalog suites
npm test

# Run headless automator simulator
npm run test:sim

# Run real DevTools automator test (requires opening HTTP service port in DevTools)
npm run test:e2e
```

### 5. Pull Request Guidelines
1. Ensure all existing tests pass (`npm test`).
2. Add comprehensive tests for any new features or bug fixes.
3. Ensure no global universal selector (`*`) is introduced in WXSS (WeChat MiniProgram compiler constraint).
4. Maintain TypeScript declarations in `index.d.ts` and `miniprogram/index.d.ts`.
5. Keep commits clean, semantic, and descriptive.
6. Generate a changeset for any user-facing fixes or enhancements (`npm run changeset`).

### 6. Versioning and Releases
We use [@changesets/cli](https://github.com/changesets/changesets) for SemVer versioning and package publishing:
- `npm run changeset`: Create a new changeset markdown document describing your changes.
- `npm run version-packages`: Consume changesets and bump package version.
- `npm run release`: Publish updated packages to the npm registry.

## License

By contributing to a2ui-miniprogram, you agree that your contributions will be licensed under the [MIT License](LICENSE).
