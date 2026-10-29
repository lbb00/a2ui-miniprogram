# Changelog

## 0.1.1

### Patch Changes

- Release 0.1.1: documentation internationalization, clean DevTools preview screenshot, and OIDC Trusted Publishing support.

All notable changes to **a2ui-miniprogram** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-29

### Initial Production Open-Source Release

#### Core Engine & Protocol
- **A2UI v1.0 Specification Compliance**: Full alignment with `agent_to_renderer.json` and `renderer_to_agent.json` official specifications.
- **Taro Static Template Unrolling**: High-performance recursive rendering with `tmpl_0` through `tmpl_4` pre-compiled templates, with zero custom-component instance overhead for normal hierarchy depth.
- **Level Fallback Trampoline**: `<a2ui-surface-layer>` component safely breaking recursive depth limit (> 4 levels) without stack overflow.
- **Directional Patching & Cursor Jump Prevention**: `computeTreePatches` calculates minimal differential properties for `setData`, preventing native text input cursor resets during real-device typing.
- **A2UI Action & RPC Protocol**: Outbound action events with contextual dynamic path solving, standard structured error messages (`VALIDATION_FAILED`, `UNKNOWN_COMPONENT`, `EXECUTION_ERROR`, `UNALLOWED_PARENT`, `UNALLOWED_CHILD`, `UNKNOWN_FUNCTION`), and `callRendererFunction` client RPC support.

#### Security & Robustness
- **ReDoS Backtracking Defense**: Static analysis blocking catastrophic exponential and polynomial ReDoS patterns (`(a|a)+`, `(a+)+`, `.*a.*a.*a`, `^\d*\w*\d*\w*!$`), with group boundary delimiter recognition allowing safe recursive patterns.
- **Prototype Pollution Prevention**: `setIn` and `updateDataModel` deep sanitization filtering `__proto__`, `constructor`, and `prototype` across root replacements, child mutations, and array pushes.
- **Safe Rich Text & XSS Defense**: Safe markdown parser with HTML entity escaping, link URL protocol whitelist (`http/https`), and fenced code block support (`<pre><code class="a2ui-code-block">`).

#### Component Catalog
- **Basic Catalog Support**: `Card`, `Column`, `Row`, `Text`, `Button`, `TextField` (obscured password support), `ChoicePicker` (multi-selection, chips, native picker), `DateTimeInput` (ISO / UTC timezone conversion), `CheckBox`, `Slider`, `Divider`, `Image`, `Icon`, `Tabs`, `Modal`, `List` (vertical and horizontal scroll).
- **TypeScript Support**: Full TypeScript declarations in `index.d.ts` and `miniprogram/index.d.ts`.
