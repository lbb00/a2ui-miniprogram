/**
 * A2UI MiniProgram 业务自定义组件官方标准 Behavior 基类
 * 
 * 核心功能：
 * 1. 规范化输入属性：node, surfaceId, uiState, scope
 * 2. 自动开启 { bubbles: true, composed: true } 穿透 Shadow DOM
 * 3. 内置拼音输入法合成态保护 (IME Composition Guard)，避免受控输入光标跳动与丢字
 */

/* global Behavior */
const a2uiCustomBehavior = (typeof Behavior === 'function')
  ? Behavior({
      properties: {
        node: {
          type: Object,
          value: null,
        },
        surfaceId: {
          type: String,
          value: '',
        },
        uiState: {
          type: Object,
          value: {},
        },
        scope: {
          type: Object,
          value: null,
        },
      },

      data: {
        isComposing: false,
      },

      methods: {
        /**
         * 派发 A2UI 动作消息
         * @param {Object|null} customContext - 运行时额外携带的动态上下文 (如点击数据点坐标)
         */
        dispatchAction(customContext = null) {
          const node = this.data.node;
          if (!node) return;
          const actionPayload = customContext
            ? {
                name: (node.action && node.action.event && node.action.event.name) || (node.action && node.action.name) || 'custom_action',
                context: customContext,
              }
            : (node.action && (node.action.event || node.action));

          this.triggerEvent(
            'action',
            {
              componentId: node.id,
              action: actionPayload,
            },
            {
              bubbles: true,
              composed: true,
            }
          );
        },

        /**
         * 派发双向数据绑定输入变更
         * @param {*} value - 新值
         * @param {string|null} customPath - 指定回写路径 (默认使用 node.valuePath)
         */
        dispatchInput(value, customPath = null) {
          const node = this.data.node;
          if (!node) return;
          const targetPath = customPath || node.valuePath;
          if (!targetPath) return;

          this.triggerEvent(
            'inputChange',
            {
              componentId: node.id,
              path: targetPath,
              value,
            },
            {
              bubbles: true,
              composed: true,
            }
          );
        },

        /**
         * IME 拼音输入法合成开始
         */
        onCompositionStart() {
          this.data.isComposing = true;
        },

        /**
         * IME 拼音输入法合成结束
         */
        onCompositionEnd(e) {
          this.data.isComposing = false;
          if (e && e.detail && e.detail.value !== undefined) {
            this.dispatchInput(e.detail.value);
          }
        },

        /**
         * 安全输入处理函数：在 IME 合成阶段阻断数据冲刷
         */
        handleSafeInput(e) {
          if (this.data.isComposing) return;
          const val = e && e.detail ? e.detail.value : e;
          this.dispatchInput(val);
        },
      },
    })
  : {};

module.exports = {
  a2uiCustomBehavior,
};
