# a2ui-miniprogram

[English](./) | 简体中文

面向 [A2UI (Agent-to-User Interface)](https://github.com/a2ui-project/a2ui) 规范的原生[微信小程序](https://developers.weixin.qq.com/miniprogram/dev/framework/)渲染器，针对双线程通信与局部差量更新进行优化。

<p align="center">
  <a href="https://www.npmjs.com/package/a2ui-miniprogram"><img src="https://img.shields.io/npm/v/a2ui-miniprogram.svg?style=flat-square&color=6a6eac" alt="npm version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license"/></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-22%20%7C%2024-brightgreen.svg?style=flat-square" alt="node version"/></a>
  <a href="https://developers.weixin.qq.com/miniprogram/dev/framework/"><img src="https://img.shields.io/badge/%E5%BE%AE%E4%BF%A1%E5%B0%8F%E7%A8%8B%E5%BA%8F-%E2%89%A5%202.14.0-07c160.svg?style=flat-square" alt="wechat miniprogram"/></a>
  <a href="https://github.com/a2ui-project/a2ui"><img src="https://img.shields.io/badge/A2UI%20%E8%A7%84%E8%8C%83-v1.0-10b981.svg?style=flat-square" alt="spec"/></a>
  <a href="scripts/run-tests.js"><img src="https://img.shields.io/badge/tests-25%2F25%20passed-success.svg?style=flat-square" alt="tests"/></a>
  <a href="scripts/benchmark-wechat-perf.js"><img src="https://img.shields.io/badge/benchmarks-passing-blue.svg?style=flat-square" alt="benchmarks"/></a>
  <a href="miniprogram/index.d.ts"><img src="https://img.shields.io/badge/TypeScript-Ready-3178c6.svg?style=flat-square" alt="typescript"/></a>
</p>

<p align="center">
  <img src="assets/screenshots/agent-preview.png" alt="A2UI 微信小程序智能体交互界面" width="380" />
</p>

---

## 核心特性

- **A2UI v1.0 规范对齐**：支持 `createSurface`、`updateComponents`、`updateDataModel`、`deleteSurface` 以及端侧 RPC（`callRendererFunction`）。
- **局部差量更新**：`computeTreePatches` 提供精确到属性与数组下标级的补丁更新，减少 `setData` 序列化载荷（基准测试场景下较全量 AST 降低 70%~97%）。
- **流式合帧调度**：基于 `wx.nextTick` 将高频打字机式的事件排放聚合成单帧更新，减轻通信桥堵塞。
- **模版静态展开**：0~4 级静态模版全部编译为原生 WXML 标签，维持单根组件实例与扁平 DOM 深度（43 个官方规范用例中最大深度为 14 层）。
- **受控输入体验保护**：敲键触发时自动避免重复回写当前活跃输入框的 value，缓解真机输入法光标跳跃问题，同时允许外部显式重置。
- **资源清理**：组件 `detached` 生命周期内主动解绑引擎监听、定时器与状态引用，降低长会话内存残留。
- **安全防护**：内置 ReDoS 正则防护（含嵌套与固定次数解析）、原型链污染阻断（`__proto__`、`constructor`）与安全 Markdown 解析。
- **扩展支持**：内置外围布局插槽（`header`、`footer`、`empty`），并通过抽象节点（`componentGenerics`）支持业务定制图表、地图与复杂组件。

---

## 架构设计

```mermaid
sequenceDiagram
    autonumber
    participant Agent as 后端智能体 / 大模型
    participant Engine as A2UIEngine
    participant Surface as <a2ui-surface>
    participant Native as 微信原生视图层

    Agent->>Engine: A2UI 消息流 (createSurface, updateComponents 等)
    Engine->>Engine: 解析路径、JSON 指针与动态表达式
    Engine->>Surface: 分发 RenderTree / 差量 Patches
    Surface->>Native: setData (5 级模板展开)
    Native->>Surface: 用户点击 / 表单输入事件
    Surface->>Engine: computeTreePatches (定向差量更新)
    Surface->>Engine: createActionMessage(surfaceId, componentId)
    Engine->>Agent: 出站交互事件 (携带动态绑定上下文)
```

---

## 性能表现与微信运行时基准

### 测试环境与评估方法

以下基准数据基于运行 `npm run bench`（对应脚本 [`scripts/benchmark-wechat-perf.js`](file:///private/tmp/a2ui-miniprogram/scripts/benchmark-wechat-perf.js)），针对全部 43 个官方 A2UI 规范用例测得。

- **处理器架构**：ARM64 / Apple Silicon (10 核) 与 Linux x86_64 (CI)
- **操作系统**：macOS / Ubuntu Linux
- **Node 环境**：Node.js v22.x / v24.x (V8 12.x)
- **小程序基础库目标**：微信小程序基础库 $\ge$ 2.14.0
- **组件仿真框架**：`miniprogram-simulate` v1.6.1（微信官方 Exparser 组件系统与模版编译仿真）

> **关于移动端真机耗时的说明**：下方列出的逻辑流水线耗时为逻辑线程内的纯 CPU 计算耗时（指针寻址、AST 重估与 Diff 计算）。在移动端真机（iOS JSCore / Android V8）上，端到端渲染还包含跨进程 JSBridge 序列化与原生排版通信开销（通常视手机芯片与系统负载在 2~16 ms 之间）。

### 微信官方规范参考打分卡

| 评测维度 | 微信建议 / 限制参考 | 基准实测数据（43 个规范用例） | 状态 |
| :--- | :--- | :--- | :--- |
| **WXML DOM 节点总量** | 建议单页 `< 1,000` 节点 | 平均 **25.4** 节点/页（峰值 **67** 节点） | 在建议范围内 |
| **DOM 嵌套深度** | 建议单页 `< 32` 层 | 实测最大深度 **14** 层 | 在建议范围内 |
| **自定义组件实例开销** | 避免过度嵌套产生 Shadow Root 冗余 | **1** 个根组件实例（`<a2ui-surface>`，5 级模版展开） | 扁平层级 |
| **`setData` 传输体积** | 建议单次 `< 50 KB`，上限 `256 KB` | 局部差量补丁单次约 **60 ~ 300 字节** | 明显优化 |
| **通信桥流式调度** | 避免未合帧高频调用堵塞通信桥 | 基于 `wx.nextTick` 合帧至 60 FPS 帧率 | 已做合帧 |
| **输入框光标稳定性** | 避免逻辑层回写冲刷导致光标跳动 | 敲键更新自动跳过当前激活输入框补丁 | 已做保护 |
| **生命周期资源回收** | 避免长会话持续累积内存 | 200 轮循环后残留实例与监听器均为 0 | 清理正常 |
| **逻辑流水线计算耗时** | 60 FPS 单帧预算为 `16.66 ms` | ARM64 下约 **0.10 ms** / 虚拟化 CI 上约 **0.50 ms** | < 1 ms |
| **更新处理吞吐量** | 支撑流式吐字与频繁交互 | 不同变异模式下约 **2,500 ~ 100,000 ops/sec** | 吞吐充裕 |

### `setData` 通信带宽优化（全量 AST vs 差量 Patch）

| 典型交互场景 | 全量 AST 大小 | 差量补丁大小 | 实测降低幅度 |
| :--- | :--- | :--- | :--- |
| **大模型流式打字追加 Token** | `1,170 B` | `319 B` | **72.74%** |
| **动态价格变动 ($199.99 -> $99.99)** | `3,372 B` | `81 B` | **97.60%** |
| **表单校验状态切换 (按钮禁用/启用)** | `762 B` | `208 B` | **72.70%** |
| **动态列表项追加 (15 -> 16 项)** | `4,019 B` | `279 B` | **93.06%** |

### 单次数据变动逻辑流水线耗时分解（1,000 次采样均值）

| 流水线执行阶段 | 实测耗时（ARM64） | 占 16.66ms 帧预算比例 | 说明 |
| :--- | :--- | :--- | :--- |
| **1. RFC 6901 `updateDataModel`** | `45.4 μs` (`0.045 ms`) | ~0.27% | 路径寻址、原型链过滤与数据写入 |
| **2. `getRenderTree` AST 重算** | `44.6 μs` (`0.045 ms`) | ~0.27% | 动态作用域解析、`@call` 函数求值、校验规则链 |
| **3. `computeTreePatches` Diff** | `9.9 μs` (`0.010 ms`) | ~0.06% | 差量补丁计算、输入状态保护、数组前缀匹配 |
| **4. JSON 序列化准备** | `0.2 μs` (`0.000 ms`) | ~0.00% | 补丁数据准备供通信桥发送 |
| **逻辑线程全流程总耗时** | **`100.2 μs` (`0.100 ms`)** | **`0.60%`** | **为视图层真机渲染预留充足预算** |

在本地执行基准测试套件：
```bash
npm run bench
```

---

## 安装使用

```bash
npm install a2ui-miniprogram --save
```

在微信开发者工具中，点击菜单栏 **工具 ➔ 构建 npm**。

---

## 快速上手

### 1. 声明引入组件

在页面 JSON 文件中（如 `pages/index/index.json`）：

```json
{
  "usingComponents": {
    "a2ui-surface": "a2ui-miniprogram/components/a2ui-surface/a2ui-surface"
  }
}
```

### 2. 在 WXML 中放置画布

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

### 3. 在页面 Page 中初始化引擎并投喂消息

```javascript
import { A2UIEngine } from 'a2ui-miniprogram';

Page({
  onLoad() {
    this.engine = new A2UIEngine();

    // 监听出站消息（用户在 UI 上的点击/提交交互反哺给 Agent）
    this.engine.onOutboundMessage((msg) => {
      console.log('出站消息给 Agent:', msg);
    });
  },

  onReady() {
    const surface = this.selectComponent('#main-surface');
    if (surface) {
      surface.setEngine(this.engine);
    }

    // 投喂 A2UI 消息流
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
            { id: 'title', component: 'Text', text: '用户登录', variant: 'title' },
            { id: 'input_name', component: 'TextField', label: '用户名', value: { '@path': '/username' } },
            {
              id: 'submit_btn',
              component: 'Button',
              text: '提交',
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
    console.log('用户触发动作:', action);
  },

  onInputChange(e) {
    const { path, value } = e.detail;
    console.log(`数据路径 ${path} 变更为:`, value);
  },
});
```

---

## 支持组件清单

完整覆盖 A2UI v1.0 基础组件规范（Basic Catalog）全部 18 个标准组件：

| 组件名称 | 小程序原生实现方式 | 核心特性与说明 |
| :--- | :--- | :--- |
| **Card** | `view.a2ui-card` | 容器卡片，支持内外边距与阴影深度 |
| **Column** | `view.a2ui-column` | 垂直弹性布局（支持 `align`、`justify`） |
| **Row** | `view.a2ui-row` | 水平弹性布局（支持 `weight` 比例自适应） |
| **List** | `scroll-view` | 纵向及横向滚动列表 |
| **Text** | `text` / `rich-text` | 文本排版层级，支持安全的行内及块级 Markdown |
| **Image** | `image` | 响应式图片，原生开启 `webp` 与懒加载 |
| **Icon** | `text.a2ui-icon` | 语义化矢量图标 |
| **Video** | `video` | 原生视频播放器，支持封面图与控制条 |
| **AudioPlayer** | `view.a2ui-audio-card` | 音频播放器卡片，包含进度与曲目元信息 |
| **Button** | `button.a2ui-btn` | 交互按钮（`primary`、`outlined`、禁用态、加载态） |
| **TextField** | `input.a2ui-input` | 单行输入框，带动态校验规则（checks）与双向数据绑定 |
| **ChoicePicker** | `picker` / `chips` / `checkbox` | 单选/多选选择器，支持原生选择框与药丸标签形态 |
| **DateTimeInput**| `picker` (date / time) | 日期/时间选择器，支持 ISO UTC 与本地时间双向转换 |
| **CheckBox** | `checkbox-group` | 布尔开关与复选框，双向绑定布尔值 |
| **Slider** | `slider` | 滑动范围选择器，支持 `min`、`max`、`step` |
| **Divider** | `view.a2ui-divider` | 结构分割线 |
| **Tabs** | `scroll-view` + 标签栏 | 标签页切换容器，内部维护 `uiState` 状态隔离 |
| **Modal** | `view.a2ui-modal-mask` | 弹出层对话框，支持点击蒙层与触发器关闭 |

---

## 自定义组件扩展与插槽系统

### 1. 布局插槽（Layout Slots）

`<a2ui-surface>` 提供了三个预置插槽，方便宿主定制外围布局：

- `slot="header"`：顶部区域（例如状态栏、Agent“思考中”动效）。
- `slot="empty"`：空状态或骨架屏。
- `slot="footer"`：底部操作栏（例如快捷提示词、操作按钮）。

```html
<a2ui-surface surfaceId="my_surface">
  <view slot="header" wx:if="{{isThinking}}">AI 正在深度思考并生成界面...</view>
  <view slot="footer">
    <button size="mini" bindtap="onQuickReply">查看近 30 天消费趋势</button>
  </view>
</a2ui-surface>
```

### 2. 业务自定义节点组件（Custom Components）

如需接入非标准组件（如 ECharts 图表、原生地图、特型营销卡片），可通过微信小程序的抽象节点（`componentGenerics`）无缝集成：

```html
<!-- 在页面 WXML 中注入抽象节点分发器 -->
<a2ui-surface
  surfaceId="dashboard"
  generic:a2ui-custom-node="custom-dispatcher"
/>
```

```html
<!-- custom-dispatcher.wxml 负责将自定义组件映射到具体实现 -->
<my-chart wx:if="{{node.component === 'VegaChart'}}" node="{{node}}" surfaceId="{{surfaceId}}" />
<my-map wx:elif="{{node.component === 'MapView'}}" node="{{node}}" surfaceId="{{surfaceId}}" />
```

引入 `a2uiCustomBehavior` 实现标准出站动作派发：

```javascript
import { a2uiCustomBehavior } from 'a2ui-miniprogram';

Component({
  behaviors: [a2uiCustomBehavior],
  methods: {
    handleSelect(item) {
      // 派发标准 A2UI 动作事件给外层 surface，自动带上上下文
      this.dispatchAction({ selectedId: item.id });
    },
  },
});
```

针对带有 `children` 的容器型自定义组件，可在模板中嵌入 `<a2ui-node-slot>` 将子节点倒灌回 A2UI 渲染链路：

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

> **基础库要求**：微信小程序基础库 `>= 2.14.0`（覆盖超过 99.5% 的真机用户）。

---

## 主题定制（Design Tokens）

通过 CSS 变量（Variables）轻松定制品牌外观：

```css
/* 在 app.wxss 或 page.wxss 中声明 */
page {
  --a2ui-primary-color: #07c160;          /* 品牌主色 */
  --a2ui-primary-contrast: #ffffff;       /* 主色按钮文字颜色 */
  --a2ui-surface-bg: #ffffff;             /* 卡片/画布背景色 */
  --a2ui-card-radius: 20rpx;              /* 卡片圆角 */
  --a2ui-card-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
  --a2ui-border-color: rgba(0, 0, 0, 0.08);
}
```

官方 A2UI 蓝紫演示主题可在 `miniprogram/themes/theme-purple.wxss` 中引入。

---

## API 参考

### `A2UIEngine` 核心类

```typescript
import { A2UIEngine } from 'a2ui-miniprogram';

const engine = new A2UIEngine();

// 批量处理 A2UI 消息数组
engine.process(messages);

// 获取指定 surface 的渲染树
const tree = engine.getRenderTree('surface_id');

// 订阅出站动作、错误与响应事件
const unsubscribe = engine.onOutboundMessage((msg) => { ... });

// 注册客户端自定义 RPC 原生函数
engine.registerRendererFunction('getSystemInfo', (args) => {
  return wx.getSystemInfoSync();
});

// 计算两棵渲染树的差量补丁字典
const patches = engine.computeTreePatches(oldTree, newTree, 'localRenderTree');

// 销毁并释放所有资源
engine.destroy();
```

### `<a2ui-surface>` 属性与方法

| 属性 / 方法 | 类型 | 默认值 | 详细说明 |
| :--- | :--- | :--- | :--- |
| `surfaceId` | `String` | `""` | 目标绑定的 surface 画布 ID |
| `conversationId` | `String` | `""` | 会话 ID（发生变更时自动重置局部视图状态） |
| `renderTree` | `Object` | `null` | 独立模式：直接传入已编译解析好的渲染树 |
| `emptyHint` | `String` | `""` | 当画布为空时的默认占位提示文案 |
| `setEngine(engine)` | `Method` | - | 注入并绑定外部 `A2UIEngine` 实例 |
| `resetSession()` | `Method` | - | 重置视图状态同时保留已绑定的引擎实例 |
| `clear(keepEngine)` | `Method` | - | 清空组件内部所有状态 |

### `<a2ui-surface>` 监听事件

| 事件名 | `e.detail` 内容 | 触发说明 |
| :--- | :--- | :--- |
| `bind:action` | `{ surfaceId, componentId, action, eventMessage }` | 用户点击按钮或触发组件交互动作时派发 |
| `bind:inputChange` | `{ surfaceId, componentId, path, value }` | 表单输入控件的值发生变动时派发 |
| `bind:rendered` | `{ surfaceId }` | 画布节点完成初次渲染或更新时派发 |
| `bind:error` | `{ version, error }` | 协议解析、表达式求值或运行时异常时派发 |

---

## 自动化测试与基准验证

```bash
# 运行单元测试、安全渗透及回归测试（25 套套件）
npm test

# 运行微信小程序真实运行时性能基准评测
npm run bench

# 运行基于 miniprogram-simulate 的无头组件仿真测试
npm run test:sim

# 运行基于微信官方 miniprogram-automator 的端到端测试
npm run test:e2e
```

---

## 贡献指南

详情请查阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 开源协议

本项目采用 [MIT 许可证](LICENSE)。
