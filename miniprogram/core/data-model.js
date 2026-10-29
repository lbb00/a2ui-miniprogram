/**
 * A2UI Data Model & Path Resolver
 * 遵循 A2UI v1.0 规范，解析 @path 寻址（支持绝对路径与局部作用域相对路径）
 * 支持 15 大内置函数、TR35 日期格式化、单遍安全插值、原型链防护
 */

const { parsePointer, getIn, resolveSegs } = require('./pointer');

/**
 * 根据 JSON Pointer (RFC 6901) 解析数据路径，如 "/name", "/items/0/title"
 */
function getValueByPath(dataModel, path, scope = null) {
  if (path == null) return undefined;
  if (path === '/') return dataModel;
  if (typeof path !== 'string') return undefined;

  // 1. 空路径 @path: "" 对应当前项自身 (CR-N5)
  if (path === '') {
    if (scope && scope.base && Array.isArray(scope.base)) {
      return getIn(dataModel, scope.base);
    }
    if (scope && typeof scope === 'object' && 'data' in scope) {
      return scope.data;
    }
    return dataModel;
  }

  // 2. 如果是不以 / 开头的相对路径，优先从当前局部作用域取值
  if (!path.startsWith('/')) {
    // 现代作用域对象: { base: [...], index: number, data?: object }
    if (scope && scope.base && Array.isArray(scope.base)) {
      const fullSegs = resolveSegs(path, scope);
      return getIn(dataModel, fullSegs);
    }
    // 传统普通对象作用域: { title: '...', count: 5 }
    if (scope && typeof scope === 'object') {
      const segs = parsePointer(path);
      const val = getIn(scope, segs);
      if (val !== undefined) return val;
      // 严格符合规范：相对路径未在局部作用域命中时，不回退到根模型
      return undefined;
    }
  }

  // 3. 绝对路径（或无 scope 时的路径）从根模型寻址
  const segments = parsePointer(path);
  return getIn(dataModel, segments);
}

/**
 * 递归求解对象或数组中的所有 @path 和表达式（支持 scope 局部作用域与防环深度保护）
 */
function resolveDeep(target, dataModel, scope = null, depth = 0, seen = new WeakSet()) {
  if (target == null) return target;
  if (typeof target !== 'object') {
    return resolveValue(target, dataModel, scope);
  }

  // 防御深度超限与循环引用崩溃 (SEC-H2)
  if (depth > 32 || seen.has(target)) {
    return target;
  }
  seen.add(target);

  if ('@path' in target || '@call' in target) {
    return resolveValue(target, dataModel, scope);
  }

  if (Array.isArray(target)) {
    return target.map((item) => resolveDeep(item, dataModel, scope, depth + 1, seen));
  }

  const result = {};
  for (const key of Object.keys(target)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    result[key] = resolveDeep(target[key], dataModel, scope, depth + 1, seen);
  }
  return result;
}

/**
 * 格式化输出为字符串
 */
function stringifyValue(val) {
  if (val == null) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/**
 * 寻找与 `${` 配对的闭合花括号 `}`，跳过字符串与嵌套括号
 */
function findCloseBrace(str, startPos) {
  let depth = 1;
  let inQuote = null;
  for (let i = startPos; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      if (ch === inQuote) {
        let bsCount = 0;
        let j = i - 1;
        while (j >= 0 && str[j] === '\\') {
          bsCount++;
          j--;
        }
        if (bsCount % 2 === 0) {
          inQuote = null;
        }
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 解析形如 `value: ${/price}, currency: EUR` 的命名参数字符串
 */
function parseNamedArgs(str, dataModel, scope) {
  const args = {};
  let depth = 0;
  let inQuote = null;
  let start = 0;
  const parts = [];

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      if (ch === inQuote) {
        // 奇偶反斜杠校验，精准识别转义反斜杠 (SEC-M3)
        let bsCount = 0;
        let j = i - 1;
        while (j >= 0 && str[j] === '\\') {
          bsCount++;
          j--;
        }
        if (bsCount % 2 === 0) {
          inQuote = null;
        }
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === '(' || ch === '{' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      parts.push(str.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (start < str.length) {
    const rem = str.slice(start).trim();
    if (rem) parts.push(rem);
  }

  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx > 0) {
      const k = part.slice(0, colonIdx).trim();
      // 原型链污染过滤 (SEC-M3)
      if (k === '__proto__' || k === 'prototype' || k === 'constructor') {
        continue;
      }
      let rawV = part.slice(colonIdx + 1).trim();

      // 引号字符串 (支持 \" 与 \\ 转义还原)
      if (
        (rawV.startsWith('"') && rawV.endsWith('"')) ||
        (rawV.startsWith("'") && rawV.endsWith("'"))
      ) {
        const q = rawV[0];
        args[k] = rawV.slice(1, -1).replace(new RegExp(`\\\\([${q}\\\\])`, 'g'), '$1');
      } else if (rawV.startsWith('${') && rawV.endsWith('}')) {
        // 嵌套表达式
        const innerExpr = rawV.slice(2, -1).trim();
        args[k] = evalExpression(innerExpr, dataModel, scope);
      } else if (!isNaN(Number(rawV)) && rawV !== '') {
        args[k] = Number(rawV);
      } else if (rawV === 'true') {
        args[k] = true;
      } else if (rawV === 'false') {
        args[k] = false;
      } else if (rawV.match(/^([@a-zA-Z0-9_]+)\((.*)\)$/s)) {
        // 嵌套函数调用 (CR-N9b)
        args[k] = evalExpression(rawV, dataModel, scope);
      } else if (rawV.startsWith('/')) {
        // 绝对路径引用
        args[k] = getValueByPath(dataModel, rawV, scope);
      } else {
        // 相对路径优先，若不存在则作为字符串常量 (如 currency: EUR)
        const pathVal = getValueByPath(dataModel, rawV, scope);
        args[k] = pathVal !== undefined ? pathVal : rawV;
      }
    } else if (parts.length === 1) {
      // 缺省单位置参数自动映射为 'value' (如 not(/flag) 或 required(/name))
      const rawV = part.trim();
      if (
        (rawV.startsWith('"') && rawV.endsWith('"')) ||
        (rawV.startsWith("'") && rawV.endsWith("'"))
      ) {
        const q = rawV[0];
        args.value = rawV.slice(1, -1).replace(new RegExp(`\\\\([${q}\\\\])`, 'g'), '$1');
      } else if (rawV.startsWith('${') && rawV.endsWith('}')) {
        const innerExpr = rawV.slice(2, -1).trim();
        args.value = evalExpression(innerExpr, dataModel, scope);
      } else if (!isNaN(Number(rawV)) && rawV !== '') {
        args.value = Number(rawV);
      } else if (rawV === 'true') {
        args.value = true;
      } else if (rawV === 'false') {
        args.value = false;
      } else if (rawV.match(/^([@a-zA-Z0-9_]+)\((.*)\)$/s)) {
        args.value = evalExpression(rawV, dataModel, scope);
      } else if (rawV.startsWith('/')) {
        args.value = getValueByPath(dataModel, rawV, scope);
      } else {
        const pathVal = getValueByPath(dataModel, rawV, scope);
        args.value = pathVal !== undefined ? pathVal : rawV;
      }
    }
  }

  return args;
}

/**
 * 求解单个表达式（路径或函数调用）
 */
function evalExpression(expr, dataModel, scope) {
  const trimmed = expr.trim();
  if (!trimmed) return '';

  // 1. 函数调用: fnName(args...)
  const fnMatch = trimmed.match(/^([@a-zA-Z0-9_]+)\((.*)\)$/s);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const argStr = fnMatch[2];
    const parsedArgs = parseNamedArgs(argStr, dataModel, scope);
    return evaluateFunction(fnName, parsedArgs, dataModel, scope);
  }

  // 2. 路径求值
  return getValueByPath(dataModel, trimmed, scope);
}

/**
 * 单遍扫描安全模板插值（防御二次执行注入漏洞，支持 \${ 转义）
 */
function interpolate(str, dataModel, scope) {
  let out = '';
  for (let i = 0; i < str.length; ) {
    // 1. 支持转义: \${ -> ${
    if (str[i] === '\\' && str.startsWith('${', i + 1)) {
      out += '${';
      i += 3;
      continue;
    }

    // 2. 匹配 ${...}
    if (str.startsWith('${', i)) {
      const closeIdx = findCloseBrace(str, i + 2);
      if (closeIdx < 0) {
        out += str.slice(i);
        break;
      }
      const expr = str.slice(i + 2, closeIdx).trim();
      const val = evalExpression(expr, dataModel, scope);
      out += stringifyValue(val);
      i = closeIdx + 1;
      continue;
    }

    out += str[i++];
  }
  return out;
}

/**
 * 解析 A2UI 属性值，支持静态常量、{"@path": "xxx"} 引用、以及基础函数调用
 */
function resolveValue(val, dataModel, scope = null) {
  if (val == null) return val;

  // 1. 路径对象: {"@path": "title"} 或 {"@path": "/items/0"} 或 {"@path": ""}
  if (typeof val === 'object' && '@path' in val) {
    const resolved = getValueByPath(dataModel, val['@path'], scope);
    return resolved !== undefined ? resolved : '';
  }

  // 2. 函数调用对象: {"@call": "formatCurrency", "args": {...}}
  if (typeof val === 'object' && '@call' in val) {
    return evaluateFunction(val['@call'], val.args, dataModel, scope);
  }

  // 3. 字符串内部模板替换: 单遍扫描，防止数据再次触发注入
  if (typeof val === 'string' && val.includes('${')) {
    return interpolate(val, dataModel, scope);
  }

  return val;
}

/**
 * Unicode TR35 模式日期格式化 (支持字面量引号、EEE、yyy、y 等，CR-N8)
 */
function formatTR35Date(d, pattern) {
  if (isNaN(d.getTime())) return '';
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const daysShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const year = d.getFullYear();
  const month = d.getMonth();
  const date = d.getDate();
  const day = d.getDay();
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ampm = hours24 < 12 ? 'AM' : 'PM';

  // 优先保留单引号包裹的字面量，支持 '' 转义单引号，如 'o''clock' -> o'clock
  const literals = [];
  let s = pattern.replace(/'((?:''|[^'])*)'/g, (_, lit) => {
    literals.push(lit.replace(/''/g, "'"));
    return `\x00${literals.length - 1}\x00`;
  });

  const tokens = {
    'yyyy': String(year),
    'yyy': String(year),
    'yy': String(year).slice(-2),
    'y': String(year),
    'MMMM': months[month],
    'MMM': monthsShort[month],
    'MM': String(month + 1).padStart(2, '0'),
    'M': String(month + 1),
    'dd': String(date).padStart(2, '0'),
    'd': String(date),
    'EEEE': days[day],
    'EEE': daysShort[day],
    'E': daysShort[day],
    'HH': String(hours24).padStart(2, '0'),
    'H': String(hours24),
    'hh': String(hours12).padStart(2, '0'),
    'h': String(hours12),
    'mm': String(minutes).padStart(2, '0'),
    'm': String(minutes),
    'ss': String(seconds).padStart(2, '0'),
    's': String(seconds),
    'a': ampm,
  };

  const re = /(yyyy|yyy|yy|y|MMMM|MMM|MM|M|EEEE|EEE|E|dd|d|HH|H|hh|h|mm|m|ss|s|a)/g;
  s = s.replace(re, (m) => (tokens[m] !== undefined ? tokens[m] : m));

  // 恢复字面量
  s = s.replace(/\x00(\d+)\x00/g, (_, idx) => literals[Number(idx)]);
  return s;
}

/**
 * 静态语法结构推演：验证正则表达式是否存在 ReDoS 灾难性指数回溯与多项式回溯风险
 * 精准拦截以下几类回溯爆炸结构，杜绝主线程卡死：
 * 1. 紧邻相邻量词：a++, a**, a+* 等
 * 2. 具有重叠集合的多重无界量化：\d*\w*\d*\w*, \w*\d*\w* 等
 * 3. 连续 3 个及以上无约束的 .* 且中间仅用普通单个字符连接 (如 .*a.*a.*a)
 * 4. 连续 3 次及以上重复完全相同的量化基元（如 \d+\d+\d+ 或 a+a+a+）
 * 5. 包含分支 (|) 或无界量词 (+, *, {n,}) 且外层受无界量词约束的复合结构：^((a)|(a))+$, ^(a|(a))+$, (a+)+ 等
 * 精准放行合法且安全的常见规则：
 * - 邮箱与域名递归：^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$, ^([a-z0-9-]+\.)+[a-z]{2,}$
 * - 千分位数字：^\d{1,3}(,\d{3})*$
 * - 大小写词组：^([A-Z][a-z]+ ?)+$
 * - 十六进制颜色：^#([0-9a-fA-F]{3}){1,2}$
 * - 基础字符类与电话日期：^[a-z]+[0-9]+$, ^.*@.*\..*$, ^[A-Z]{2}\d{6}$, ^(\+86)?1[3-9]\d{9}$
 */
function isSafeRegex(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > 300) {
    return false;
  }
  // 1. 紧邻相邻量词
  if (/[+*]\s*[+*]/.test(pattern)) return false;

  // 2. 具有重叠集合的多重无界量化 (如 \d*\w*\d*\w*, \w*\d*\w*)
  if (/(\\d|\\w)[*+][^\\^$]*(\\w|\\d)[*+][^\\^$]*(\\w|\\d)[*+]/.test(pattern)) {
    return false;
  }

  // 3. 连续 3 个及以上无约束的 .* 且中间仅用普通单个字符连接 (如 .*a.*a.*a)
  if (/\.\*[^\\^$@,/:;.?#]+\.\*[^\\^$@,/:;.?#]+\.\*/.test(pattern)) {
    return false;
  }

  // 4. 连续 3 次及以上重复完全相同的量化基元（如 \d+\d+\d+ 或 a+a+a+）
  if (/((\\[dswDSW]|\.|[a-zA-Z0-9])(\+|\*|\{[\d,]+\}))\s*(\1\s*){2,}/.test(pattern)) {
    return false;
  }

  // 5. 语法分析：括号内存在 | 或无界嵌套量词，且括号后附带 +, *, {n,} 累积重复
  const stack = [];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      const nextCh = pattern[i + 1];
      if (nextCh === '.' || nextCh === ',' || nextCh === '-' || nextCh === '/' || nextCh === '@' || nextCh === ':' || nextCh === ';' || nextCh === '_' || nextCh === '=' || nextCh === '&') {
        if (stack.length > 0) {
          const top = stack[stack.length - 1];
          if (!top.seenQuantifier) top.hasStartDelimiter = true;
          top.lastWasDelimiter = true;
        }
      } else {
        if (stack.length > 0) stack[stack.length - 1].lastWasDelimiter = false;
      }
      i++; // 跳过转义字符
      continue;
    }
    if (ch === '[') {
      // 遍历跳过字符类内部，严格验证字符类闭合
      let closed = false;
      while (i < pattern.length) {
        if (pattern[i] === '\\') i++;
        i++;
        if (pattern[i] === ']') {
          closed = true;
          break;
        }
      }
      if (!closed) return false; // 字符类未闭合
      if (stack.length > 0) stack[stack.length - 1].lastWasDelimiter = false;
      continue;
    }
    if (ch === '(') {
      stack.push({
        hasAlternation: false,
        hasUnboundedQuantifier: false,
        hasStartDelimiter: false,
        hasEndDelimiter: false,
        lastWasDelimiter: false,
        seenQuantifier: false,
      });
      // 跳过非捕获组与断言前缀 (?:, ?=, ?!, ?<=, ?<!)，防止冒号等符号被误识别为分隔符
      if (pattern[i + 1] === '?') {
        if (pattern.startsWith('?<=', i + 1) || pattern.startsWith('?<!', i + 1)) {
          i += 3;
        } else if (pattern.startsWith('?:', i + 1) || pattern.startsWith('?=', i + 1) || pattern.startsWith('?!', i + 1)) {
          i += 2;
        }
      }
      continue;
    }
    if (ch === '|') {
      if (stack.length > 0) {
        stack[stack.length - 1].hasAlternation = true;
        stack[stack.length - 1].lastWasDelimiter = false;
      }
      continue;
    }
    if (ch === '+' || ch === '*') {
      if (stack.length > 0) {
        stack[stack.length - 1].hasUnboundedQuantifier = true;
        stack[stack.length - 1].seenQuantifier = true;
        stack[stack.length - 1].lastWasDelimiter = false;
      }
      continue;
    }
    if (ch === '{') {
      const braceEnd = pattern.indexOf('}', i);
      if (braceEnd > i) {
        const bc = pattern.slice(i + 1, braceEnd).trim();
        if (bc.includes(',')) {
          const parts = bc.split(',');
          const max = parts[1].trim();
          if (max === '' || Number(max) > 5) {
            if (stack.length > 0) {
              stack[stack.length - 1].hasUnboundedQuantifier = true;
              stack[stack.length - 1].seenQuantifier = true;
              stack[stack.length - 1].lastWasDelimiter = false;
            }
          }
        }
        i = braceEnd;
      }
      continue;
    }
    if (ch === ',' || ch === '@' || ch === ':' || ch === '/' || ch === '-' || ch === ' ' || ch === ';' || ch === '_' || ch === '=' || ch === '&') {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (!top.seenQuantifier) top.hasStartDelimiter = true;
        top.lastWasDelimiter = true;
      }
      continue;
    }
    if (ch === ')') {
      const groupInfo = stack.pop();
      if (!groupInfo) return false; // 括号未闭合
      if (groupInfo.lastWasDelimiter) {
        groupInfo.hasEndDelimiter = true;
      }
      let j = i + 1;
      while (j < pattern.length && pattern[j] === ' ') j++;
      if (j < pattern.length) {
        const next = pattern[j];
        let isOuterUnbounded = next === '+' || next === '*';
        if (next === '{') {
          const braceEnd = pattern.indexOf('}', j);
          if (braceEnd > j) {
            const bc = pattern.slice(j + 1, braceEnd).trim();
            if (bc.includes(',')) {
              const parts = bc.split(',');
              if (parts[1].trim() === '' || Number(parts[1].trim()) > 5) {
                isOuterUnbounded = true;
              }
            }
          }
        }
        if (isOuterUnbounded) {
          // 组内存在分支 (|)：如 ((a)|(a))+ 或 (a|a)+ -> 拦截！
          if (groupInfo.hasAlternation) {
            return false;
          }
          // 组内存在内部无界量词，且组边界【缺乏定界符隔离】：如 (a+)+ 或 ([a-z]+)+ 或 ([a-z]+_[a-z]+)+ -> 拦截！
          // 若组首或组尾具备定界符（如 ([\w-]+\.)+ 或 (,\d{3})+ 或 (\w+;)+），跨组迭代有强定界符隔离，放行！
          const isBoundaryGuarded = groupInfo.hasStartDelimiter || groupInfo.hasEndDelimiter;
          if (groupInfo.hasUnboundedQuantifier && !isBoundaryGuarded) {
            return false;
          }
        }
      }
      if (stack.length > 0) {
        if (groupInfo.hasAlternation) stack[stack.length - 1].hasAlternation = true;
        if (groupInfo.hasUnboundedQuantifier) stack[stack.length - 1].hasUnboundedQuantifier = true;
        stack[stack.length - 1].lastWasDelimiter = false;
      }
      continue;
    }
    if (stack.length > 0 && ch !== '^' && ch !== '$' && ch !== '?') {
      stack[stack.length - 1].lastWasDelimiter = false;
    }
  }
  return stack.length === 0;
}

/**
 * 校验值或 ValidationResult 是否为真
 */
function toBool(v) {
  if (v && typeof v === 'object' && 'valid' in v) {
    return Boolean(v.valid);
  }
  return Boolean(v);
}

/**
 * 国际化货币符号映射 (A2UI Basic Catalog 规范)
 * 支持 EUR -> €, GBP -> £, JPY/CNY -> ¥, INR -> ₹, CAD/AUD/USD -> $, KRW -> ₩ 等常见币种
 */
const CURRENCY_SYMBOLS = {
  USD: '$',
  CAD: '$',
  AUD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  RMB: '¥',
  INR: '₹',
  KRW: '₩',
};

function getCurrencySymbol(currency) {
  if (!currency) return '$';
  const key = String(currency).trim().toUpperCase();
  if (CURRENCY_SYMBOLS[key]) {
    return CURRENCY_SYMBOLS[key];
  }
  return '$';
}

/**
 * formatCurrency 国际化货币格式化函数
 */
function formatCurrency(value, currency, decimals = 2, grouping = false) {
  const num = Number(value) || 0;
  const symbol = getCurrencySymbol(currency);
  const dec = Math.min(Math.max(Number(decimals) || 0, 0), 20);
  const isNeg = num < 0;
  const absVal = Math.abs(num);
  const formattedNum = grouping
    ? absVal.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : absVal.toFixed(dec);

  return isNeg ? `-${symbol}${formattedNum}` : `${symbol}${formattedNum}`;
}

/**
 * 完整复数分支匹配算法 (A2UI Basic Catalog 规范)
 * 接收 value 与复数分支 (zero, one, two, few, many, other)，依据数字大小与分支动态匹配返回正确字符串
 */
function executePluralize(value, forms = {}, locale = 'en-US') {
  const num = Number(value) || 0;
  let category;

  if (num === 0 && forms.zero !== undefined) {
    category = 'zero';
  } else if (num === 1 && forms.one !== undefined) {
    category = 'one';
  } else if (num === 2 && forms.two !== undefined) {
    category = 'two';
  } else {
    try {
      if (typeof Intl !== 'undefined' && Intl.PluralRules) {
        category = new Intl.PluralRules(locale).select(num);
      }
    } catch (_) {}
  }

  // 1. 若 CLDR / Intl 命中的分类在 forms 中有定义，直接使用
  if (category && forms[category] !== undefined) {
    return forms[category];
  }

  // 2. 针对 few / many 等分支进行数值范围与优先级兜底匹配（当 CLDR 规则未捕获但入参显式声明对应分支时）
  if (category === 'other' || !category) {
    if (num >= 3 && num <= 10 && forms.few !== undefined && forms.other === undefined) {
      return forms.few;
    }
    if (num > 10 && forms.many !== undefined && forms.other === undefined) {
      return forms.many;
    }
  }

  // 3. other 分支兜底，若未提供 other 则尝试 one
  if (forms.other !== undefined) {
    return forms.other;
  }
  return forms.one !== undefined ? forms.one : '';
}

let mockClipboardData = '';
let mockToast = null;

function getMockState() {
  return {
    clipboard: mockClipboardData,
    toast: mockToast,
  };
}

function resetMockState() {
  mockClipboardData = '';
  mockToast = null;
}

/**
 * openUrl 规范与微信小程序平台降级体验
 * 严格限制必须为 HTTP/HTTPS 链接；在小程序平台下自动复制链接至剪贴板并通过友好 toast 提示
 */
function openUrl(url) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Invalid URL: must be a non-empty string' };
  }

  const trimmed = url.trim();
  // 规范严格限制：只允许 HTTP/HTTPS 协议
  if (!/^https?:\/\//i.test(trimmed)) {
    return { success: false, error: 'Unsupported URL scheme: only HTTP/HTTPS are allowed' };
  }

  // 1. 微信小程序环境：复制到剪贴板并通过 toast 友好提示
  if (typeof wx !== 'undefined') {
    if (wx.setClipboardData) {
      wx.setClipboardData({
        data: trimmed,
        success: () => {
          if (wx.showToast) {
            wx.showToast({
              title: '链接已复制，请在浏览器中打开',
              icon: 'none',
              duration: 2500,
            });
          }
        },
      });
    } else if (wx.showToast) {
      wx.showToast({
        title: '链接已复制，请在浏览器中打开',
        icon: 'none',
        duration: 2500,
      });
    }
    mockClipboardData = trimmed;
    mockToast = { title: '链接已复制，请在浏览器中打开', icon: 'none' };
    return { success: true, url: trimmed, action: 'copied_to_clipboard' };
  }

  // 2. 浏览器环境：新标签页安全打开
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(trimmed, '_blank', 'noopener,noreferrer');
    return { success: true, url: trimmed, action: 'window_open' };
  }

  // 3. Node 仿真环境：记录剪贴板与友好 Toast
  mockClipboardData = trimmed;
  mockToast = { title: '链接已复制，请在浏览器中打开', icon: 'none' };
  return { success: true, url: trimmed, action: 'copied_to_clipboard' };
}

/**
 * A2UI 标准 Capability 报文协商生成器 (遵循 renderer_capabilities.json 规范)
 */
const DEFAULT_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

function createRendererCapabilities(supportedCatalogs) {
  let catalogIds = [];
  let inlineCatalogs = undefined;

  if (typeof supportedCatalogs === 'string') {
    catalogIds = [supportedCatalogs];
  } else if (Array.isArray(supportedCatalogs)) {
    for (const item of supportedCatalogs) {
      if (typeof item === 'string') {
        catalogIds.push(item);
      } else if (item && typeof item === 'object') {
        if (item.catalogId) {
          catalogIds.push(item.catalogId);
        }
        if (item.inlineCatalog) {
          if (!inlineCatalogs) inlineCatalogs = [];
          inlineCatalogs.push(item.inlineCatalog);
        }
      }
    }
    if (!catalogIds.includes(DEFAULT_CATALOG_ID)) {
      catalogIds.push(DEFAULT_CATALOG_ID);
    }
  } else if (supportedCatalogs && typeof supportedCatalogs === 'object') {
    if (Array.isArray(supportedCatalogs.supportedCatalogIds)) {
      catalogIds = supportedCatalogs.supportedCatalogIds.slice();
    } else if (supportedCatalogs.catalogId) {
      catalogIds = [supportedCatalogs.catalogId];
    }
    if (Array.isArray(supportedCatalogs.inlineCatalogs)) {
      inlineCatalogs = supportedCatalogs.inlineCatalogs.slice();
    }
  } else {
    catalogIds = [DEFAULT_CATALOG_ID];
  }

  const v10Obj = {
    supportedCatalogIds: catalogIds,
  };
  if (inlineCatalogs && inlineCatalogs.length > 0) {
    v10Obj.inlineCatalogs = inlineCatalogs;
  }

  return {
    'v1.0': v10Obj,
  };
}

/**
 * 官方 15 大内置函数库求解
 */
function evaluateFunction(funcName, args = {}, dataModel = {}, scope = null) {
  const resolvedArgs = {};
  if (args && typeof args === 'object') {
    for (const k of Object.keys(args)) {
      resolvedArgs[k] = resolveDeep(args[k], dataModel, scope);
    }
  }

  switch (funcName) {
    case 'formatCurrency': {
      return formatCurrency(
        resolvedArgs.value,
        resolvedArgs.currency,
        resolvedArgs.decimals,
        resolvedArgs.grouping
      );
    }

    case 'formatNumber': {
      const num = Number(resolvedArgs.value);
      if (isNaN(num)) return stringifyValue(resolvedArgs.value);
      const rawDec = resolvedArgs.decimals !== undefined ? Number(resolvedArgs.decimals) : undefined;
      const decimals = rawDec !== undefined ? Math.min(Math.max(rawDec || 0, 0), 20) : undefined;
      const grouping = resolvedArgs.grouping !== undefined ? Boolean(resolvedArgs.grouping) : true;
      const opts = { useGrouping: grouping };
      if (decimals !== undefined) {
        opts.minimumFractionDigits = decimals;
        opts.maximumFractionDigits = decimals;
      }
      return num.toLocaleString('en-US', opts);
    }

    case 'formatDate': {
      let rawDate = resolvedArgs.value;
      if (rawDate === null || rawDate === undefined || rawDate === '') return '';
      // 支持纯数字字符串时间戳 (如 "1730160000000" 或 10 位秒级时间戳)
      if (typeof rawDate === 'string' && /^\d{10,13}$/.test(rawDate.trim())) {
        const num = Number(rawDate.trim());
        rawDate = rawDate.trim().length === 10 ? num * 1000 : num;
      } else if (typeof rawDate === 'number' && rawDate > 0 && rawDate < 10000000000) {
        rawDate = rawDate * 1000;
      }
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return String(rawDate);

      const pattern = resolvedArgs.format;
      if (!pattern || typeof pattern !== 'string') {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return formatTR35Date(d, pattern);
    }

    case 'pluralize': {
      return executePluralize(resolvedArgs.value, resolvedArgs, resolvedArgs.locale || 'en-US');
    }

    // 彻底杜绝二次执行与注入漏洞 (CR-N1)
    case 'formatString': {
      return resolvedArgs.value != null ? String(resolvedArgs.value) : '';
    }

    // 校验与逻辑运算函数 (支持 ValidationResult)
    case 'required': {
      const val = resolvedArgs.value;
      let valid = true;
      if (val === null || val === undefined) {
        valid = false;
      } else if (typeof val === 'string') {
        valid = val.trim().length > 0;
      } else if (Array.isArray(val)) {
        valid = val.length > 0;
      } else if (typeof val === 'object') {
        valid = Object.keys(val).length > 0;
      }
      return valid;
    }

    case 'email': {
      const raw = resolvedArgs.value !== undefined
        ? resolvedArgs.value
        : (resolvedArgs.email !== undefined ? resolvedArgs.email : (resolvedArgs.text !== undefined ? resolvedArgs.text : ''));
      if (raw === null || raw === undefined || raw === '') return false;
      const val = String(raw).trim();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    }

    case 'length': {
      const val = resolvedArgs.value;
      if (val == null) return false;
      const len = Array.isArray(val)
        ? val.length
        : (typeof val === 'object' ? Object.keys(val).length : String(val).length);
      const min = resolvedArgs.min !== undefined ? Number(resolvedArgs.min) : 0;
      const max = resolvedArgs.max !== undefined ? Number(resolvedArgs.max) : Infinity;
      return len >= min && len <= max;
    }

    case 'numeric': {
      const val = resolvedArgs.value;
      if (val === '' || val === null || val === undefined || typeof val === 'boolean' || Array.isArray(val)) {
        return false;
      }
      const num = Number(val);
      if (isNaN(num)) return false;
      const min = resolvedArgs.min !== undefined ? Number(resolvedArgs.min) : -Infinity;
      const max = resolvedArgs.max !== undefined ? Number(resolvedArgs.max) : Infinity;
      return num >= min && num <= max;
    }

    case 'regex': {
      const rawVal = resolvedArgs.value !== undefined
        ? resolvedArgs.value
        : (resolvedArgs.text !== undefined ? resolvedArgs.text : (resolvedArgs.input !== undefined ? resolvedArgs.input : ''));
      const val = String(rawVal !== null && rawVal !== undefined ? rawVal : '');
      const pattern = resolvedArgs.pattern !== undefined ? resolvedArgs.pattern : '.*';
      // 文本与模式长度限制 (上限 250 字符文本，200 字符模式)
      if (typeof pattern !== 'string' || pattern.length > 200) {
        console.warn(`[A2UI Validation] regex pattern invalid or exceeds 200 characters: ${pattern}`);
        return false;
      }
      if (val.length > 250) {
        console.warn(`[A2UI Validation] regex input string length (${val.length}) exceeds safe limit (250 chars). Rejected to prevent ReDoS.`);
        return false;
      }
      // 深度静态结构分析拦截 ReDoS 灾难性指数与多项式回溯
      if (!isSafeRegex(pattern)) {
        console.warn(`[A2UI Validation] regex pattern "${pattern}" rejected by ReDoS protection policy.`);
        return false;
      }
      try {
        const re = new RegExp(pattern);
        return re.test(val);
      } catch (err) {
        console.warn(`[A2UI Validation] RegExp compilation failed for pattern "${pattern}":`, err.message);
        return false;
      }
    }

    case 'and': {
      const values =
        resolvedArgs.values ||
        resolvedArgs.conditions ||
        (Array.isArray(resolvedArgs) ? resolvedArgs : Object.values(resolvedArgs));
      return (Array.isArray(values) ? values : []).every(toBool);
    }

    case 'or': {
      const values =
        resolvedArgs.values ||
        resolvedArgs.conditions ||
        (Array.isArray(resolvedArgs) ? resolvedArgs : Object.values(resolvedArgs));
      return (Array.isArray(values) ? values : []).some(toBool);
    }

    case 'not': {
      return !toBool(resolvedArgs.value);
    }

    case 'index':
    case '@index': {
      return scope && scope.index !== undefined ? scope.index : 0;
    }

    case 'openUrl': {
      // 纯函数计算：渲染求值中绝不调用 wx.setClipboardData 或 wx.showToast 等具有副作用的系统 API (仅做 URL 格式校验与清洗)
      const targetUrl = resolvedArgs.url !== undefined
        ? resolvedArgs.url
        : (resolvedArgs.target !== undefined ? resolvedArgs.target : resolvedArgs.value);
      if (typeof targetUrl === 'string') {
        const trimmed = targetUrl.trim();
        if (/^https?:\/\//i.test(trimmed)) {
          return trimmed;
        }
      }
      return '';
    }

    default:
      return resolvedArgs.value !== undefined ? String(resolvedArgs.value) : '';
  }
}

module.exports = {
  getValueByPath,
  resolveValue,
  resolveDeep,
  evaluateFunction,
  isSafeRegex,
  executePluralize,
  openUrl,
  createRendererCapabilities,
  getMockState,
  resetMockState,
  toBool,
  formatTR35Date,
  CURRENCY_SYMBOLS,
  getCurrencySymbol,
  formatCurrency,
};
