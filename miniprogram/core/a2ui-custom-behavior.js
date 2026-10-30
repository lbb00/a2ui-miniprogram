/**
 * A2UI MiniProgram Standard Behavior Base Class for Custom Components
 * 
 * Core Capabilities:
 * 1. Standardizes input properties: node, surfaceId, uiState, scope
 * 2. Automatically sets { bubbles: true, composed: true } across Shadow DOM
 * 3. Built-in IME Composition Guard to prevent cursor jumping and text loss
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
         * Dispatch A2UI action message
         * @param {Object|null} customContext - Dynamic runtime context (e.g. clicked data coordinates)
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
         * Dispatch two-way data-bound input change
         * @param {*} value - New value
         * @param {string|null} customPath - Explicit target path (defaults to node.valuePath)
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
         * IME composition start
         */
        onCompositionStart() {
          this.data.isComposing = true;
        },

        /**
         * IME composition end
         */
        onCompositionEnd(e) {
          this.data.isComposing = false;
          if (e && e.detail && e.detail.value !== undefined) {
            this.dispatchInput(e.detail.value);
          }
        },

        /**
         * Safe input handler: blocks data flushing during IME composition
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
