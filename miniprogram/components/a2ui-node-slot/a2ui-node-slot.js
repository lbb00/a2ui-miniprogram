Component({
  options: {
    virtualHost: true,
    styleIsolation: 'apply-shared',
  },

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

  methods: {
    onRelayAction(e) {
      this.triggerEvent('action', e.detail, { bubbles: true, composed: true });
    },
    onRelayInput(e) {
      this.triggerEvent('inputChange', e.detail, { bubbles: true, composed: true });
    },
    onRelayUIState(e) {
      this.triggerEvent('uiStateChange', e.detail, { bubbles: true, composed: true });
    },
  },
});
