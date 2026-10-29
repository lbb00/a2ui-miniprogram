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

  data: {
    isDev: false,
  },

  lifetimes: {
    attached() {
      let isDev = false;
      try {
        if (typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function') {
          const info = wx.getAccountInfoSync();
          if (info && info.miniProgram && info.miniProgram.envVersion) {
            const env = info.miniProgram.envVersion;
            isDev = (env === 'develop' || env === 'trial');
          }
        }
      } catch (_) {
        isDev = false;
      }
      this.setData({ isDev });
    },
  },
});
