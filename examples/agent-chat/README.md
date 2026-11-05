# A2UI Agent 对话微信小程序示例 (Agent Chat Example)

本示例展示如何在独立微信小程序中以 npm 模块形式引入 [`a2ui-miniprogram`](../../)，结合大模型 Function Calling（以 DeepSeek 为例）与双向交互动作闭环，实现纯净、自解释的 AI 生成式卡片交互。

---

## 🌟 核心特性

1. **自解释布局与视觉去噪**：
   - 彻底移除冗余次级标签与说教式文案，由 A2UI 结构化卡片（航班号、登机时间、商品规格、核验表单等）自然呈现。
2. **移动端原生交互标杆**：
   - **输入框贴底与安全区自适应**：键盘收起时适配全面屏底部横条，抬起时消除黑边。
   - **键盘抬起动画与时间同步**：精准读取微信底层的 `duration`（0.25s），CSS 缓动严丝合缝。
   - **双向平滑触底**：聊天流与卡片展开时自动平滑滚动触底。
3. **零门槛开箱即用（无需配置 API Key）**：
   - 默认启动**智能本地仿真模式（Mock Loop）**，零配置直接体验航班查询、选座值机、商品领券及表单双向交互。
   - 如需连接真实大模型，只需配置 `DEEPSEEK_API_KEY` 环境变量或在小程序本地缓存注入即可无缝切换真实 API。

---

## 🚀 快速开始

### 1. 构建依赖

在当前目录下执行构建脚本（模拟微信开发者工具的「构建 npm」）：

```bash
cd examples/agent-chat
node scripts/build-npm.js
```

### 2. 运行自动化测试

```bash
# 运行 Agent 状态机与全链路交互用例 (本地仿真，无需网络与 API Key)
npm test

# 运行自动化端到端测试
npm run test:automator
```

---

## 💻 微信开发者工具中预览

1. 打开微信开发者工具，点击 **「导入工程」**。
2. 目录选择：`examples/agent-chat`。
3. AppID：选择 **测试号** 或填入您的小程序 AppID。
4. 在开发者工具菜单栏点击：**「工具」 ➔ 「构建 npm」**。
5. 编译运行，即可直接在模拟器中体验对话、点击快捷芯片与卡片交互！

---

## 🔑 接入真实大模型 API（可选）

本示例默认工作在纯本地仿真模式，保证开箱即用。若想体验真实大模型：

- **方式一（命令行 / 测试）**：
  ```bash
  export DEEPSEEK_API_KEY="your-deepseek-api-key"
  npm test
  ```
- **方式二（小程序内设置）**：
  在控制台执行：
  ```javascript
  wx.setStorageSync('DEEPSEEK_API_KEY', 'your-deepseek-api-key');
  ```
  刷新页面后，Agent 即可通过 `wx.request` 实时发起 Function Calling。
