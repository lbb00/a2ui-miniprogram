# a2ui-miniprogram

English | [简体中文](README.zh-CN.md)

High-performance native [WeChat Mini Program](https://developers.weixin.qq.com/miniprogram/dev/framework/) renderer for the [A2UI (Agent-to-User Interface)](https://github.com/a2ui-project/a2ui) specification, tailored for mobile dual-thread execution, sub-millisecond state updates, and bandwidth-optimized `setData` transfers.

<p align="center">
  <a href="https://www.npmjs.com/package/a2ui-miniprogram"><img src="https://img.shields.io/npm/v/a2ui-miniprogram.svg?style=flat-square&color=6a6eac" alt="npm version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license"/></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-22%20%7C%2024-brightgreen.svg?style=flat-square" alt="node version"/></a>
  <a href="https://developers.weixin.qq.com/miniprogram/dev/framework/"><img src="https://img.shields.io/badge/WeChat%20Mini%20Program-%E2%89%A5%202.14.0-07c160.svg?style=flat-square" alt="wechat miniprogram"/></a>
  <a href="https://github.com/a2ui-project/a2ui"><img src="https://img.shields.io/badge/A2UI%20Spec-v1.0%20Compliant-10b981.svg?style=flat-square" alt="spec"/></a>
  <a href="scripts/run-tests.js"><img src="https://img.shields.io/badge/tests-25%2F25%20passed-success.svg?style=flat-square" alt="tests"/></a>
  <a href="scripts/benchmark-wechat-perf.js"><img src="https://img.shields.io/badge/setData%20reduction-up%20to%2097.6%25-blue.svg?style=flat-square" alt="setData reduction"/></a>
  <a href="scripts/benchmark-wechat-perf.js"><img src="https://img.shields.io/badge/pipeline%20latency-0.10ms-brightgreen.svg?style=flat-square" alt="pipeline latency"/></a>
  <a href="miniprogram/index.d.ts"><img src="https://img.shields.io/badge/TypeScript-Ready-3178c6.svg?style=flat-square" alt="typescript"/></a>
</p>

<p align="center">
  <img src="assets/screenshots/agent-preview.png" alt="A2UI WeChat MiniProgram Agent Chat Preview" width="380" />
</p>

---

## Key Highlights & Performance

- **Sub-Millisecond Data Pipeline**: Full update pipeline (RFC 6901 mutation $\to$ AST evaluation $\to$ differential patch diffing) executes in **~0.10 ms**, consuming only **0.60%** of the 60 FPS (16.66ms) frame budget.
- **Up to 97.6% `setData` Bandwidth Reduction**: Granular path-level and array-index differential patches (`computeTreePatches`) shrink bridge payloads from kilobytes to ~80 bytes.
- **Streaming Frame Coalescing (`wx.nextTick`)**: Automatically merges high-frequency AI Agent token chunk streams into smooth 60 FPS frame renders, cutting JSBridge traffic congestion by **99%**.
- **Template Unrolling (Zero Component Bloat)**: Levels 0–4 static WXML template unrolling renders purely native tags with only **1** root custom component instance, avoiding Shadow DOM memory duplication and maintaining ultra-flat DOM depth (average 25 nodes, max depth 14).
- **Two-Way Input Anti-Jump Protection**: Directional differential diffing skips active input value writes during user typing while safely honoring programmatic form resets.
- **A2UI v1.0 Spec Compliance**: Complete support for `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`, and client RPC (`callRendererFunction`).
- **Zero Memory Leak Resilience**: Clean lifecycle teardown with 0 lingering listeners and 0 surviving surfaces across 200 consecutive lifecycle cycles.
- **Hardened Security**: ReDoS regex guards against nested/fixed quantifiers, prototype pollution prevention (`__proto__`, `constructor`), and safe URL/markdown sanitization.
- **Extensible Architecture**: Layout slots (`header`, `footer`, `empty`) and business custom components via WeChat `componentGenerics`.

---

## Architecture

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Backend Agent / LLM
    participant Engine as A2UIEngine
    participant Surface as <a2ui-surface>
    participant Native as WeChat Native View

    Agent->>Engine: A2UI Messages (createSurface, updateComponents, etc.)
    Engine->>Engine: Resolve Paths, JSON Pointer & Expressions
    Engine->>Surface: Dispatch RenderTree / Patches
    Surface->>Native: setData (Template Unrolling)
    Native->>Surface: User Tap / Input Event
    Surface->>Engine: computeTreePatches (Directional Update)
    Surface->>Engine: createActionMessage(surfaceId, componentId)
    Engine->>Agent: Outbound Action Event with Dynamic Context
```

---

## Performance & WeChat Runtime Benchmarks

The A2UI WeChat Mini Program renderer is engineered specifically for the mobile dual-thread execution model (JSCore Logic Thread vs WKWebView Render Thread) and WeChat Exparser component architecture.

### WeChat Official Performance Compliance Scorecard

| Evaluation Dimension | WeChat Official Constraint | A2UI Benchmark Result | Compliance Status |
| :--- | :--- | :--- | :--- |
| **WXML DOM Nodes Count** | Warning at `> 1,000` nodes | **25.4** average (Peak: **67** nodes across all 43 official spec files) | **100% Compliant** |
| **DOM Nesting Depth** | Hard warning at `> 32` levels | **14** levels maximum | **100% Compliant** |
| **Custom Component Count** | Shadow Root instantiation overhead | **1** root component instance (`<a2ui-surface>`) via 5-level unrolling | **Ultra-Flat** |
| **`setData` Payload Volume** | Recommended `< 50 KB`, upper limit `256 KB` | **60 ~ 300 Bytes** per delta patch | **Up to 97.6% Savings** |
| **Bridge Streaming Rate** | Avoid high-frequency unbatched bridge saturation | Coalesced via `wx.nextTick` into smooth 60 FPS frames | **99.0% Traffic Reduction** |
| **Two-Way Input Stability** | View-layer overwrite causes cursor jumping | Value omitted from typing patches while honoring resets | **Zero Cursor Jump** |
| **Memory Leak Resilience** | Bounded mobile RAM limits | 0 surviving surfaces/listeners across 200 creation-destruction cycles | **Zero Memory Leaks** |
| **Data Mutation Pipeline Latency** | Frame budget `< 16.66 ms` for 60 FPS | **0.100 ms** per update (consumes only **0.60%** of frame budget) | **Sub-Millisecond** |
| **State Mutation Throughput** | Support rapid gesture & stream updates | **2,500 ~ 104,000 ops/sec** across data mutation patterns | **High Throughput** |

### `setData` Bandwidth Optimization (Full AST vs Targeted Delta Patch)

| Scenario | Full AST Size | Delta Patch Size | Bandwidth Reduction |
| :--- | :--- | :--- | :--- |
| **Streaming LLM Token Append** | `1,170 B` | `319 B` | **72.74%** |
| **Dynamic Price Update ($199.99 -> $99.99)** | `3,372 B` | `81 B` | **97.60%** |
| **Form Validation State (Button Enable/Disable)** | `762 B` | `208 B` | **72.70%** |
| **Incremental Array Item Append (15 -> 16 items)** | `4,019 B` | `279 B` | **93.06%** |

### Per-Mutation Pipeline Phase Latency Breakdown (1,000 Iterations)

| Pipeline Phase | Mean Latency | Percentage of 60 FPS Budget | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Phase 1: RFC 6901 `updateDataModel`** | `45.4 μs` (`0.045 ms`) | ~0.27% | Path parsing, prototype pollution defense, state write |
| **Phase 2: `getRenderTree` AST Eval** | `44.6 μs` (`0.045 ms`) | ~0.27% | Dynamic scope resolution, `@call` functions, validation rules |
| **Phase 3: `computeTreePatches` Diff** | `9.9 μs` (`0.010 ms`) | ~0.06% | Differential patch calculation, array prefix optimization |
| **Phase 4: JSON Serialization** | `0.2 μs` (`0.000 ms`) | ~0.00% | Compact JSON stringification for JSBridge |
| **Total Logic Thread Time** | **`100.2 μs` (`0.100 ms`)** | **`0.60%`** | **99.40% frame budget remaining for 60 FPS render** |

Run the full benchmark suite locally:
```bash
npm run bench
```

---

## Installation

```bash
npm install a2ui-miniprogram --save
```

In WeChat Developer Tools, click **Tools ➔ Build npm**.

---

## Quick Start

### 1. Register Component

In your page JSON (e.g. `pages/index/index.json`):

```json
{
  "usingComponents": {
    "a2ui-surface": "a2ui-miniprogram/components/a2ui-surface/a2ui-surface"
  }
}
```

### 2. Add to WXML

```html
<view class="container">
  <a2ui-surface
    id="main-surface"
    surfaceId="user_form"
    bind:action="onAction"
    bind:inputChange="onInputChange"
  />
</view>
```

### 3. Initialize in Page

```javascript
import { A2UIEngine } from 'a2ui-miniprogram';

Page({
  onLoad() {
    this.engine = new A2UIEngine();

    this.engine.onOutboundMessage((msg) => {
      console.log('Outbound message to Agent:', msg);
    });
  },

  onReady() {
    const surface = this.selectComponent('#main-surface');
    if (surface) {
      surface.setEngine(this.engine);
    }

    // Process A2UI message payload
    this.engine.process([
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'user_form',
          dataModel: { username: '' },
        },
      },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'user_form',
          components: [
            { id: 'root', component: 'Card', children: ['col'] },
            { id: 'col', component: 'Column', children: ['title', 'input_name', 'submit_btn'] },
            { id: 'title', component: 'Text', text: 'Sign In', variant: 'title' },
            { id: 'input_name', component: 'TextField', label: 'Username', value: { '@path': '/username' } },
            {
              id: 'submit_btn',
              component: 'Button',
              text: 'Submit',
              variant: 'primary',
              action: {
                event: {
                  name: 'submit_form',
                  context: { user: { '@path': '/username' } },
                },
              },
            },
          ],
        },
      },
    ]);
  },

  onAction(e) {
    const { action } = e.detail;
    console.log('User action:', action);
  },

  onInputChange(e) {
    const { path, value } = e.detail;
    console.log(`Path ${path} changed to:`, value);
  },
});
```

---

## Supported Components

Covers all 18 standard components in the A2UI v1.0 Basic Catalog:

| Component | MiniProgram Native Implementation | Description |
| :--- | :--- | :--- |
| **Card** | `view.a2ui-card` | Container card with padding and elevation |
| **Column** | `view.a2ui-column` | Vertical flexbox (`align`, `justify`) |
| **Row** | `view.a2ui-row` | Horizontal flexbox with `weight` support |
| **List** | `scroll-view` | Vertical and horizontal scrollable lists |
| **Text** | `text` / `rich-text` | Typography and safe inline/block Markdown |
| **Image** | `image` | Responsive image with `fit` and WebP support |
| **Icon** | `text.a2ui-icon` | Semantic icon symbols |
| **Video** | `video` | Video player with poster and controls |
| **AudioPlayer** | `view.a2ui-audio-card` | Audio player card with track metadata |
| **Button** | `button.a2ui-btn` | Interactive button (`primary`, `outlined`, disabled) |
| **TextField** | `input.a2ui-input` | Text field with validation checks and two-way binding |
| **ChoicePicker** | `picker` / `chips` / `checkbox` | Single and multiple selection picker |
| **DateTimeInput**| `picker` (date / time) | Date and time picker with ISO UTC / local conversion |
| **CheckBox** | `checkbox-group` | Toggle checkbox with boolean data-binding |
| **Slider** | `slider` | Range slider with `min`, `max`, `step` |
| **Divider** | `view.a2ui-divider` | Visual separator line |
| **Tabs** | `scroll-view` + tab bar | Tabbed navigation container |
| **Modal** | `view.a2ui-modal-mask` | Overlay dialog with trigger control |

---

## Custom Components & Slots

### 1. Layout Slots

`<a2ui-surface>` provides three named slots for outer layout customization:

- `slot="header"`: Header area (e.g. status bar, agent thinking indicator).
- `slot="empty"`: Custom skeleton or empty state view.
- `slot="footer"`: Footer area (e.g. quick prompt chips, action bar).

```html
<a2ui-surface surfaceId="my_surface">
  <view slot="header" wx:if="{{isThinking}}">Generating response...</view>
  <view slot="footer">
    <button size="mini" bindtap="onQuickReply">Show 30-day trends</button>
  </view>
</a2ui-surface>
```

### 2. Custom Node Components

To render non-standard or business-specific components (e.g. ECharts, Map, custom widgets), declare a generic component dispatcher:

```html
<!-- In page WXML -->
<a2ui-surface
  surfaceId="dashboard"
  generic:a2ui-custom-node="custom-dispatcher"
/>
```

```html
<!-- custom-dispatcher.wxml -->
<my-chart wx:if="{{node.component === 'VegaChart'}}" node="{{node}}" surfaceId="{{surfaceId}}" />
<my-map wx:elif="{{node.component === 'MapView'}}" node="{{node}}" surfaceId="{{surfaceId}}" />
```

Use `a2uiCustomBehavior` to wire up standard action dispatching:

```javascript
import { a2uiCustomBehavior } from 'a2ui-miniprogram';

Component({
  behaviors: [a2uiCustomBehavior],
  methods: {
    handleSelect(item) {
      // Dispatches a standard A2UI action event up to the surface
      this.dispatchAction({ selectedId: item.id });
    },
  },
});
```

For container-type custom components with `children`, include `<a2ui-node-slot>` to render child A2UI nodes:

```html
<view class="my-accordion">
  <view class="accordion-title">{{node.title}}</view>
  <view class="accordion-content">
    <block wx:for="{{node.children}}" wx:key="id">
      <a2ui-node-slot node="{{item}}" surfaceId="{{surfaceId}}" uiState="{{uiState}}" scope="{{scope}}" />
    </block>
  </view>
</view>
```

> **Base Library Requirement**: MiniProgram base library `>= 2.14.0` (covering > 99.5% of WeChat users).

---

## Theming (Design Tokens)

Customization is driven by CSS Variables:

```css
/* In app.wxss or page.wxss */
page {
  --a2ui-primary-color: #07c160;          /* Brand primary */
  --a2ui-primary-contrast: #ffffff;       /* Button text on primary */
  --a2ui-surface-bg: #ffffff;             /* Surface / Card background */
  --a2ui-card-radius: 20rpx;              /* Card corner radius */
  --a2ui-card-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
  --a2ui-border-color: rgba(0, 0, 0, 0.08);
}
```

An optional Slate Lavender theme from the official A2UI catalog is provided at `miniprogram/themes/theme-purple.wxss`.

---

## API Reference

### `A2UIEngine`

```typescript
import { A2UIEngine } from 'a2ui-miniprogram';

const engine = new A2UIEngine();

// Process A2UI message array
engine.process(messages);

// Get render tree for a surface
const tree = engine.getRenderTree('surface_id');

// Subscribe to outbound actions, errors, and responses
const unsubscribe = engine.onOutboundMessage((msg) => { ... });

// Register custom client RPC function
engine.registerRendererFunction('getSystemInfo', (args) => {
  return wx.getSystemInfoSync();
});

// Calculate differential patches between two trees
const patches = engine.computeTreePatches(oldTree, newTree, 'localRenderTree');

// Cleanup
engine.destroy();
```

### `<a2ui-surface>` Properties & Methods

| Property / Method | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `surfaceId` | `String` | `""` | Target surface identifier |
| `conversationId` | `String` | `""` | Conversation ID (resets view state on change) |
| `renderTree` | `Object` | `null` | Directly pass a static render tree (standalone mode) |
| `emptyHint` | `String` | `""` | Default placeholder text when surface is empty |
| `setEngine(engine)` | `Method` | - | Bind an `A2UIEngine` instance |
| `resetSession()` | `Method` | - | Reset view state while keeping the engine bound |
| `clear(keepEngine)` | `Method` | - | Clear component state |

### `<a2ui-surface>` Events

| Event | `e.detail` | Description |
| :--- | :--- | :--- |
| `bind:action` | `{ surfaceId, componentId, action, eventMessage }` | Fired when a component action is triggered |
| `bind:inputChange` | `{ surfaceId, componentId, path, value }` | Fired on form input value change |
| `bind:rendered` | `{ surfaceId }` | Fired when surface finishes initial rendering |
| `bind:error` | `{ version, error }` | Fired on protocol parsing or runtime error |

---

## Testing & Benchmarks

```bash
# Unit, security, and regression tests (25 suites)
npm test

# WeChat runtime performance and architecture benchmark
npm run bench

# Headless component simulation test
npm run test:sim

# Automator end-to-end test
npm run test:e2e
```

---

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## License

[MIT License](LICENSE)
