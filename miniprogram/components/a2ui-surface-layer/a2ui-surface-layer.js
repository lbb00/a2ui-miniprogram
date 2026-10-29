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
  },

  methods: {
    findNodeById(root, id) {
      if (!root || !id) return null;
      if (Array.isArray(root)) {
        for (const item of root) {
          const found = this.findNodeById(item, id);
          if (found) return found;
        }
        return null;
      }
      if (root.id === id) return root;
      if (root.children && Array.isArray(root.children)) {
        for (const child of root.children) {
          const found = this.findNodeById(child, id);
          if (found) return found;
        }
      }
      if (root.triggerNode) {
        const found = this.findNodeById(root.triggerNode, id);
        if (found) return found;
      }
      if (root.contentNode) {
        const found = this.findNodeById(root.contentNode, id);
        if (found) return found;
      }
      return null;
    },

    handleTap(e) {
      const componentId = e.currentTarget.dataset.id;
      this.triggerEvent('nodeTap', { componentId, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    handleInput(e) {
      const { id, path, kind } = e.currentTarget.dataset;
      let value = e.detail.value;
      if (kind === 'bool') {
        value = Array.isArray(value) ? value.length > 0 : Boolean(value);
      } else if (kind === 'choice-multi') {
        const rawArray = Array.isArray(value) ? value : (value != null && value !== '' ? [value] : []);
        const node = this.findNodeById(this.data.node, id);
        if (node && Array.isArray(node.options)) {
          value = rawArray.map((strVal) => {
            const matchedOpt = node.options.find((opt) => {
              const optVal = (typeof opt === 'object' && opt !== null)
                ? (opt.value !== undefined ? opt.value : opt.label)
                : opt;
              return String(optVal) === String(strVal);
            });
            return matchedOpt !== undefined
              ? ((typeof matchedOpt === 'object' && matchedOpt !== null)
                  ? (matchedOpt.value !== undefined ? matchedOpt.value : matchedOpt.label)
                  : matchedOpt)
              : strVal;
          });
        } else {
          value = rawArray;
        }
      }
      this.triggerEvent('nodeInput', { componentId: id, path, value, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    handleInputFocus(e) {
      const { id } = e.currentTarget.dataset;
      this.triggerEvent('nodeFocus', { componentId: id, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    handleInputBlur(e) {
      const { id } = e.currentTarget.dataset;
      this.triggerEvent('nodeBlur', { componentId: id, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    handlePickerChange(e) {
      const { id, path } = e.currentTarget.dataset;
      const index = Number(e.detail.value);
      const node = this.findNodeById(this.data.node, id);
      let value = [index];
      if (node && Array.isArray(node.options) && node.options[index]) {
        const opt = node.options[index];
        const optVal = (typeof opt === 'object' && opt !== null)
          ? (opt.value !== undefined ? opt.value : opt.label)
          : opt;
        value = [optVal];
      }
      this.triggerEvent('nodeInput', { componentId: id, path, value, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    onChipSelect(e) {
      const { id, path, val } = e.currentTarget.dataset;
      const node = this.findNodeById(this.data.node, id);
      if (node && node.disabled) return;
      let matchedVal = val;
      if (node && Array.isArray(node.options)) {
        const found = node.options.find((opt) => {
          const optVal = (typeof opt === 'object' && opt !== null)
            ? (opt.value !== undefined ? opt.value : opt.label)
            : opt;
          return String(optVal) === String(val);
        });
        if (found !== undefined) {
          matchedVal = (typeof found === 'object' && found !== null)
            ? (found.value !== undefined ? found.value : found.label)
            : found;
        }
      }
      let targetVals = [matchedVal];
      if (node && node.mutuallyExclusive === false) {
        const curVals = Array.isArray(node.value)
          ? [...node.value]
          : (node.value !== undefined && node.value !== null && node.value !== '' ? [node.value] : []);
        const strVal = String(matchedVal);
        const idx = curVals.findIndex((v) => String(v) === strVal);
        if (idx >= 0) {
          curVals.splice(idx, 1);
        } else {
          curVals.push(matchedVal);
        }
        targetVals = curVals;
      }
      this.triggerEvent('nodeChipSelect', { componentId: id, path, value: targetVals, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    handleDateTimeChange(e) {
      const { id, path, part } = e.currentTarget.dataset;
      const newVal = e.detail.value;
      const node = this.findNodeById(this.data.node, id);

      let datePart = node ? (node.dateValue || '') : '';
      let timePart = node ? (node.timeValue || '') : '';

      if (part === 'date') {
        datePart = newVal;
      } else if (part === 'time') {
        timePart = newVal;
      }

      let finalValue = '';
      const enableDate = node ? node.enableDate !== false : true;
      const enableTime = node ? Boolean(node.enableTime) : false;

      if (enableDate && enableTime) {
        const now = new Date();
        const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const d = datePart || localToday;
        const t = timePart || '00:00';
        const s = (node && node.timeSec) ? node.timeSec : '00';
        if (node && node.isIso !== false) {
          const localDt = new Date(`${d}T${t.length === 5 ? t : t.slice(0, 5)}:${s}`);
          if (!isNaN(localDt.getTime())) {
            finalValue = localDt.toISOString();
          } else {
            finalValue = `${d}T${t}:${s}Z`;
          }
        } else {
          finalValue = `${d}T${t}:${s}`;
        }
      } else if (enableTime) {
        finalValue = timePart;
      } else {
        finalValue = datePart;
      }

      this.triggerEvent('nodeInput', { componentId: id, path, value: finalValue, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    onTabTap(e) {
      const { id, idx, uikey } = e.currentTarget.dataset;
      this.triggerEvent('nodeTabTap', { id, idx: Number(idx), uikey, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    onModalOpen(e) {
      const { id, uikey } = e.currentTarget.dataset;
      this.triggerEvent('nodeModalOpen', { id, uikey, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    onModalClose(e) {
      const { id, uikey } = e.currentTarget.dataset;
      this.triggerEvent('nodeModalClose', { id, uikey, surfaceId: this.data.surfaceId }, {
        bubbles: true,
        composed: true,
      });
    },

    onCustomAction(e) {
      this.triggerEvent('action', e.detail, { bubbles: true, composed: true });
    },

    onCustomInput(e) {
      this.triggerEvent('inputChange', e.detail, { bubbles: true, composed: true });
    },

    onCustomUIStateChange(e) {
      this.triggerEvent('uiStateChange', e.detail, { bubbles: true, composed: true });
    },

    noop() {},
  },
});