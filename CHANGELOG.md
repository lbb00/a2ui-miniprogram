# Changelog

## 0.2.0

### Minor Changes

- High-performance native WeChat Mini Program renderer benchmark verification suite:
  - Automated WXML DOM tree profiling across 43 catalog cases (average 25.4 nodes/case, peak 67 nodes, maximum depth 14 levels).
  - Granular differential patching (`computeTreePatches`) achieving up to 97.6% bandwidth reduction over full AST serialization.
  - Streaming frame coalescing (`wx.nextTick`) merging high-frequency LLM token emissions into smooth 60 FPS renders.
  - Input cursor protection preventing active input jumps while safely honoring external programmatic resets (`forceValueUpdate`).
  - Sub-millisecond data mutation pipeline (~0.10 ms logic thread execution time).
- Multi-round adversarial security and boundary audit:
  - Property deletion type safety in differential patching (defaulting deleted booleans to `false`, numbers/objects/arrays to `null`).
  - Strict RFC 6901 JSON Pointer array index validation (`/^(?:0|[1-9]\d*)$/`).
  - Hardened ReDoS quantifier analyzer against fixed repetitions `{n}` ($n > 5$).
  - Component unmount safety guards (`_isUnmounted`) preventing race conditions on detached instances.
- Documentation & Ecosystem:
  - Comprehensive Chinese documentation (`README.zh-CN.md`) with dual-language navigation.
  - Empirical host benchmark testbed specifications and mobile JSBridge serialization latency context.

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
