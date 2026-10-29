/**
 * A2UI JSON Pointer (RFC 6901) & Safe Path Resolver
 * 包含原型链污染 (Prototype Pollution) 安全防御
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * 解析 JSON Pointer 路径为段数组
 * RFC 6901: ~1 -> /, ~0 -> ~
 */
function parsePointer(path) {
  if (path == null) return [];
  if (typeof path !== 'string') return [];
  if (path === '' || path === '/') return [];

  const clean = path.startsWith('/') ? path.slice(1) : path;
  return clean.split('/').map((seg) => {
    return seg.replace(/~1/g, '/').replace(/~0/g, '~');
  });
}

/**
 * 将段数组组装为绝对 JSON Pointer 路径
 * RFC 6901: ~ -> ~0, / -> ~1
 */
function toPointer(segments) {
  if (!segments || !Array.isArray(segments) || segments.length === 0) return '/';
  return (
    '/' +
    segments
      .map((seg) => {
        return String(seg).replace(/~/g, '~0').replace(/\//g, '~1');
      })
      .join('/')
  );
}

/**
 * 安全沿路径取值，防范原型链污染
 */
function getIn(root, segments) {
  if (root == null) return undefined;
  if (!segments || segments.length === 0) return root;

  let current = root;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    if (FORBIDDEN_KEYS.has(seg)) return undefined;
    if (!hasOwn(current, seg)) return undefined;
    current = current[seg];
  }
  return current;
}

function sanitizeObject(val) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val;
  const safe = {};
  for (const [k, v] of Object.entries(val)) {
    if (!FORBIDDEN_KEYS.has(k)) {
      safe[k] = v;
    }
  }
  return safe;
}

/**
 * 安全沿路径设值，返回新的或修改后的 root
 * - 支持根替换 (segs.length === 0)
 * - 支持 null 删除字段
 * - 支持数组下标与 '-' 追加
 * - 拦截原型链污染
 */
function setIn(root, segments, value) {
  if (segments && segments.some((k) => FORBIDDEN_KEYS.has(k))) {
    throw new Error('SECURITY_ERROR: Forbidden property in path');
  }

  // 根路径替换并过滤原型链注入
  if (!segments || segments.length === 0) {
    return value == null ? {} : sanitizeObject(value);
  }

  let current = root == null || typeof root !== 'object' ? {} : root;
  const result = current;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];

    if (current[seg] == null || typeof current[seg] !== 'object') {
      current[seg] = /^\d+$/.test(nextSeg) || nextSeg === '-' ? [] : {};
    }
    current = current[seg];
  }

  const lastSeg = segments[segments.length - 1];

  if (Array.isArray(current)) {
    if (lastSeg === '-') {
      if (value !== null && value !== undefined) {
        current.push(sanitizeObject(value));
      }
    } else {
      const idx = Number(lastSeg);
      if (!isNaN(idx)) {
        if (value === null) {
          current.splice(idx, 1);
        } else {
          current[idx] = sanitizeObject(value);
        }
      }
    }
  } else if (typeof current === 'object' && current !== null) {
    if (value === null) {
      delete current[lastSeg];
    } else {
      current[lastSeg] = sanitizeObject(value);
    }
  }

  return result;
}

/**
 * 根据当前作用域解析最终的段数组
 */
function resolveSegs(path, scope) {
  if (typeof path !== 'string') return [];
  if (path.startsWith('/')) {
    return parsePointer(path);
  }
  // 相对路径
  const relSegs = parsePointer(path);
  if (scope && scope.base && Array.isArray(scope.base)) {
    return scope.base.concat(relSegs);
  }
  return relSegs;
}

/**
 * 将 JSON Pointer 或段数组转为微信小程序 setData 属性路径
 * 例如: ['children', 0, 'value'] -> 'children[0].value'
 */
function toPropertyPath(pathOrSegs, rootPrefix = '') {
  const segs = Array.isArray(pathOrSegs) ? pathOrSegs : parsePointer(pathOrSegs);
  let result = rootPrefix;
  for (const seg of segs) {
    const isNum = /^\d+$/.test(seg);
    if (isNum) {
      result = result ? `${result}[${seg}]` : `[${seg}]`;
    } else {
      result = result ? `${result}.${seg}` : seg;
    }
  }
  return result;
}

/**
 * 快速浅层对象比较
 */
function isShallowEqual(objA, objB) {
  if (objA === objB) return true;
  if (!objA || !objB || typeof objA !== 'object' || typeof objB !== 'object') return false;

  const isArrA = Array.isArray(objA);
  const isArrB = Array.isArray(objB);
  if (isArrA !== isArrB) return false;

  if (isArrA) {
    if (objA.length !== objB.length) return false;
    for (let i = 0; i < objA.length; i++) {
      if (objA[i] !== objB[i]) return false;
    }
    return true;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!Object.prototype.hasOwnProperty.call(objB, key) || objA[key] !== objB[key]) {
      return false;
    }
  }
  return true;
}

/**
 * 快速深层对象比较 (避免频繁 JSON.stringify 开销)
 */
function isDeepEqual(a, b, maxDepth = 5) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;

  const isArrA = Array.isArray(a);
  const isArrB = Array.isArray(b);
  if (isArrA !== isArrB) return false;

  if (maxDepth <= 0) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (_) {
      return false;
    }
  }

  if (isArrA) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && !isDeepEqual(a[i], b[i], maxDepth - 1)) {
        return false;
      }
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    const valA = a[k];
    const valB = b[k];
    if (valA !== valB && !isDeepEqual(valA, valB, maxDepth - 1)) {
      return false;
    }
  }
  return true;
}

/**
 * 递归计算新旧渲染树的差量补丁 (Patches)
 * 专为微信小程序 setData 定向差量刷新设计：
 * - 拦截当前受控输入框 (activeComponentId) 的 value 字段回写，从根本上防止真机输入光标跳动与输入法打断
 * - 支持按节点属性路径精确定向更新 (如 validationError, disabled, displayLabel 等)
 * - 优化数组增量补丁传输，规避全量子节点数组反复传输
 * - 纯函数设计，杜绝就地变异 oldTree
 */
function computeTreePatches(oldTree, newTree, rootPrefix = 'localRenderTree', options = {}, patches = {}) {
  if (oldTree === newTree) return patches;
  if (!oldTree || !newTree || typeof oldTree !== 'object' || typeof newTree !== 'object') {
    patches[rootPrefix] = newTree;
    return patches;
  }
  if (oldTree.component !== newTree.component || oldTree.id !== newTree.id) {
    patches[rootPrefix] = newTree;
    return patches;
  }

  const activeId = options.activeComponentId;
  const allKeys = new Set([...Object.keys(oldTree), ...Object.keys(newTree)]);

  for (const key of allKeys) {
    if (key === 'children') {
      const oldChildren = oldTree.children || [];
      const newChildren = newTree.children || [];
      if (!Array.isArray(oldChildren) || !Array.isArray(newChildren)) {
        patches[toPropertyPath(['children'], rootPrefix)] = newChildren;
      } else if (oldChildren.length === newChildren.length) {
        for (let i = 0; i < newChildren.length; i++) {
          computeTreePatches(
            oldChildren[i],
            newChildren[i],
            toPropertyPath(['children', i], rootPrefix),
            options,
            patches
          );
        }
      } else if (newChildren.length > oldChildren.length && oldChildren.length > 0) {
        const oldLen = oldChildren.length;
        let prefixMatches = true;
        for (let i = 0; i < oldLen; i++) {
          const oChild = oldChildren[i];
          const nChild = newChildren[i];
          const oId = (oChild && typeof oChild === 'object') ? oChild.id : oChild;
          const nId = (nChild && typeof nChild === 'object') ? nChild.id : nChild;
          if (oId !== nId || oId === undefined) {
            prefixMatches = false;
            break;
          }
        }

        if (prefixMatches) {
          // 前缀子项深度差量对比
          for (let i = 0; i < oldLen; i++) {
            computeTreePatches(
              oldChildren[i],
              newChildren[i],
              toPropertyPath(['children', i], rootPrefix),
              options,
              patches
            );
          }
          // 仅传输增量下标补丁
          for (let i = oldLen; i < newChildren.length; i++) {
            patches[toPropertyPath(['children', i], rootPrefix)] = newChildren[i];
          }
        } else {
          patches[toPropertyPath(['children'], rootPrefix)] = newChildren;
        }
      } else {
        patches[toPropertyPath(['children'], rootPrefix)] = newChildren;
      }
    } else if (
      (key === 'triggerNode' || key === 'contentNode') &&
      oldTree[key] &&
      newTree[key] &&
      typeof oldTree[key] === 'object' &&
      typeof newTree[key] === 'object'
    ) {
      computeTreePatches(
        oldTree[key],
        newTree[key],
        toPropertyPath([key], rootPrefix),
        options,
        patches
      );
    } else {
      // 拦截受控输入框的 value 字段回写 (防真机光标跳动与失焦)
      if (activeId && (newTree.id === activeId || newTree.sourceId === activeId) && key === 'value') {
        continue;
      }

      const oldVal = oldTree[key];
      const newVal = newTree[key];

      if (typeof newVal === 'object' && newVal !== null && typeof oldVal === 'object' && oldVal !== null) {
        if (!isDeepEqual(oldVal, newVal)) {
          patches[toPropertyPath([key], rootPrefix)] = newVal;
        }
      } else if (oldVal !== newVal) {
        const patchVal = newVal !== undefined ? newVal : (typeof oldVal === 'boolean' ? false : '');
        patches[toPropertyPath([key], rootPrefix)] = patchVal;
      }
    }
  }

  return patches;
}

module.exports = {
  FORBIDDEN_KEYS,
  parsePointer,
  toPointer,
  getIn,
  setIn,
  resolveSegs,
  toPropertyPath,
  isShallowEqual,
  isDeepEqual,
  computeTreePatches,
};
