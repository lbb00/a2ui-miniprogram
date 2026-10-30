/**
 * A2UI Data Model & Path Resolver
 * Adheres to A2UI v1.0 specification, resolves @path addressing (absolute and local scoped paths)
 * Supports 15 built-in functions, TR35 date formatting, single-pass safe interpolation, prototype pollution protection
 */

const { parsePointer, getIn, resolveSegs } = require('./pointer');

/**
 * Resolves data path according to JSON Pointer (RFC 6901), e.g. "/name", "/items/0/title"
 */
function getValueByPath(dataModel, path, scope = null) {
  if (path == null) return undefined;
  if (path === '/') return dataModel;
  if (typeof path !== 'string') return undefined;

  // 1. Empty path @path: "" corresponds to current item itself (CR-N5)
  if (path === '') {
    if (scope && scope.base && Array.isArray(scope.base)) {
      return getIn(dataModel, scope.base);
    }
    if (scope && typeof scope === 'object' && 'data' in scope) {
      return scope.data;
    }
    return dataModel;
  }

  // 2. Relative path not starting with / prioritizes local scope
  if (!path.startsWith('/')) {
    // Modern scope object: { base: [...], index: number, data?: object }
    if (scope && scope.base && Array.isArray(scope.base)) {
      const fullSegs = resolveSegs(path, scope);
      return getIn(dataModel, fullSegs);
    }
    // Traditional plain object scope: { title: '...', count: 5 }
    if (scope && typeof scope === 'object') {
      const segs = parsePointer(path);
      const val = getIn(scope, segs);
      if (val !== undefined) return val;
      // Specification compliance: relative path returns undefined when not found in scope (does not fall back to root)
      return undefined;
    }
  }

  // 3. Absolute path (or path without scope) resolved from root data model
  const segments = parsePointer(path);
  return getIn(dataModel, segments);
}

/**
 * Recursively resolves all @path and expressions in object or array (supports scope and circular reference protection)
 */
function resolveDeep(target, dataModel, scope = null, depth = 0, seen = new WeakSet()) {
  if (target == null) return target;
  if (typeof target !== 'object') {
    return resolveValue(target, dataModel, scope);
  }

  // Protection against depth overflow and circular reference crashes (SEC-H2)
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
 * Format value to string
 */
function stringifyValue(val) {
  if (val == null) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/**
 * Finds closing brace '}' matching '${', skipping strings and nested braces
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
 * Parses named argument string like `value: ${/price}, currency: EUR`
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
        // Parity check for backslashes to accurately identify escaped backslashes (SEC-M3)
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
      // Prototype pollution filter (SEC-M3)
      if (k === '__proto__' || k === 'prototype' || k === 'constructor') {
        continue;
      }
      let rawV = part.slice(colonIdx + 1).trim();

      // Quoted string (supports \" and \\ unescaping)
      if (
        (rawV.startsWith('"') && rawV.endsWith('"')) ||
        (rawV.startsWith("'") && rawV.endsWith("'"))
      ) {
        const q = rawV[0];
        args[k] = rawV.slice(1, -1).replace(new RegExp(`\\\\([${q}\\\\])`, 'g'), '$1');
      } else if (rawV.startsWith('${') && rawV.endsWith('}')) {
        // Nested expression
        const innerExpr = rawV.slice(2, -1).trim();
        args[k] = evalExpression(innerExpr, dataModel, scope);
      } else if (!isNaN(Number(rawV)) && rawV !== '') {
        args[k] = Number(rawV);
      } else if (rawV === 'true') {
        args[k] = true;
      } else if (rawV === 'false') {
        args[k] = false;
      } else if (rawV.match(/^([@a-zA-Z0-9_]+)\((.*)\)$/s)) {
        // Nested function call (CR-N9b)
        args[k] = evalExpression(rawV, dataModel, scope);
      } else if (rawV.startsWith('/')) {
        // Absolute path reference
        args[k] = getValueByPath(dataModel, rawV, scope);
      } else {
        // Relative path preferred, otherwise treated as string literal (e.g. currency: EUR)
        const pathVal = getValueByPath(dataModel, rawV, scope);
        args[k] = pathVal !== undefined ? pathVal : rawV;
      }
    } else if (parts.length === 1) {
      // Default single positional argument automatically mapped to 'value' (e.g. not(/flag) or required(/name))
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
 * Evaluates single expression (path or function call)
 */
function evalExpression(expr, dataModel, scope) {
  const trimmed = expr.trim();
  if (!trimmed) return '';

  // 1. Function call: fnName(args...)
  const fnMatch = trimmed.match(/^([@a-zA-Z0-9_]+)\((.*)\)$/s);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const argStr = fnMatch[2];
    const parsedArgs = parseNamedArgs(argStr, dataModel, scope);
    return evaluateFunction(fnName, parsedArgs, dataModel, scope);
  }

  // 2. Path evaluation
  return getValueByPath(dataModel, trimmed, scope);
}

/**
 * Single-pass safe template interpolation (prevents secondary injection, supports \${ escaping)
 */
function interpolate(str, dataModel, scope) {
  let out = '';
  for (let i = 0; i < str.length; ) {
    // 1. Supports escaping: \${ -> ${
    if (str[i] === '\\' && str.startsWith('${', i + 1)) {
      out += '${';
      i += 3;
      continue;
    }

    // 2. Match ${...}
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
 * Resolve A2UI property value supporting constants, {"@path": "xxx"} pointer references, and functions
 */
function resolveValue(val, dataModel, scope = null) {
  if (val == null) return val;

  // 1. Path pointer object: {"@path": "title"}, {"path": "title"} or {"@path": ""}
  if (typeof val === 'object' && ('@path' in val || 'path' in val)) {
    const rawPath = val['@path'] !== undefined ? val['@path'] : val.path;
    const resolved = getValueByPath(dataModel, rawPath, scope);
    return resolved !== undefined ? resolved : '';
  }

  // 2. Function call object: {"@call": "formatCurrency", "args": {...}}
  if (typeof val === 'object' && '@call' in val) {
    return evaluateFunction(val['@call'], val.args, dataModel, scope);
  }

  // 3. String template interpolation: single pass scan to prevent double injection
  if (typeof val === 'string' && val.includes('${')) {
    return interpolate(val, dataModel, scope);
  }

  return val;
}

/**
 * Unicode TR35 pattern date formatting (supports literal quotes, EEE, yyy, y, etc., CR-N8)
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

  // Preserve single-quoted literals first, supports '' escaping for single quote, e.g. 'o''clock' -> o'clock
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

  // Restore literals
  s = s.replace(/\x00(\d+)\x00/g, (_, idx) => literals[Number(idx)]);
  return s;
}

/**
 * Static syntax analysis: verifies whether regex has catastrophic exponential or polynomial backtracking (ReDoS) risks.
 * Intercepts backtracking explosion structures to prevent thread blocking:
 * 1. Adjacent quantifiers: a++, a**, a+* etc.
 * 2. Multiple unbounded quantifications with overlapping sets: \d*\w*\d*\w*, \w*\d*\w* etc.
 * 3. 3 or more unbounded .* separated only by single characters (e.g. .*a.*a.*a)
 * 4. 3 or more identical quantified primitives repeated (e.g. \d+\d+\d+ or a+a+a+)
 * 5. Nested unbounded quantifiers with alternation: ^((a)|(a))+$, ^(a|(a))+$, (a+)+ etc.
 * Permits valid and safe standard patterns:
 * - Email and domain recursion: ^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$, ^([a-z0-9-]+\.)+[a-z]{2,}$
 * - Thousands numbers: ^\d{1,3}(,\d{3})*$
 * - Cased phrases: ^([A-Z][a-z]+ ?)+$
 * - Hex colors: ^#([0-9a-fA-F]{3}){1,2}$
 * - Basic character classes and phone/dates: ^[a-z]+[0-9]+$, ^.*@.*\..*$, ^[A-Z]{2}\d{6}$, ^(\+86)?1[3-9]\d{9}$
 */
function isSafeRegex(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > 300) {
    return false;
  }
  // 1. Adjacent quantifiers
  if (/[+*]\s*[+*]/.test(pattern)) return false;

  // 2. Multiple unbounded quantifications with overlapping sets (e.g. \d*\w*\d*\w*, \w*\d*\w*)
  if (/(\\d|\\w)[*+][^\\^$]*(\\w|\\d)[*+][^\\^$]*(\\w|\\d)[*+]/.test(pattern)) {
    return false;
  }

  // 3. 3 or more unbounded .* separated only by single characters (e.g. .*a.*a.*a)
  if (/\.\*[^\\^$@,/:;.?#]+\.\*[^\\^$@,/:;.?#]+\.\*/.test(pattern)) {
    return false;
  }

  // 4. 3 or more identical quantified primitives repeated (e.g. \d+\d+\d+ or a+a+a+)
  if (/((\\[dswDSW]|\.|[a-zA-Z0-9])(\+|\*|\{[\d,]+\}))\s*(\1\s*){2,}/.test(pattern)) {
    return false;
  }

  // 5. Syntax analysis: group contains alternation | or unbounded nested quantifier with trailing +, *, {n,}
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
      i++; // Skip escape character
      continue;
    }
    if (ch === '[') {
      // Skip character class interior, verify character class closure
      let closed = false;
      while (i < pattern.length) {
        if (pattern[i] === '\\') i++;
        i++;
        if (pattern[i] === ']') {
          closed = true;
          break;
        }
      }
      if (!closed) return false; // Unclosed character class
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
      // Skip non-capturing groups and assertion prefixes (?:, ?=, ?!, ?<=, ?<!) to prevent false delimiter detection
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
        } else {
          const count = Number(bc);
          if (!isNaN(count) && count > 5) {
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
      if (!groupInfo) return false; // Unclosed parenthesis
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
            } else {
              const count = Number(bc);
              if (!isNaN(count) && count > 5) {
                isOuterUnbounded = true;
              }
            }
          }
        }
        if (isOuterUnbounded) {
          // Group contains alternation (|): e.g. ((a)|(a))+ or (a|a)+ -> intercept!
          if (groupInfo.hasAlternation) {
            return false;
          }
          // Group contains unbounded quantifier without boundary delimiter guard: e.g. (a+)+ or ([a-z]+)+ -> intercept!
          // If group has leading/trailing delimiter guard (e.g. ([\w-]+\.)+ or (,\d{3})+), iteration is guarded, allow!
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
 * Safely converts value or ValidationResult to boolean
 */
function toBool(v) {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'off' || s === 'no' || s === '') return false;
    if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true;
  }
  if (typeof v === 'object' && 'valid' in v) {
    return Boolean(v.valid);
  }
  return Boolean(v);
}

/**
 * International currency symbol mapping (A2UI Basic Catalog Specification)
 * Supports EUR -> €, GBP -> £, JPY/CNY -> ¥, INR -> ₹, CAD/AUD/USD -> $, KRW -> ₩, etc.
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
 * formatCurrency international currency formatting function
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
 * Full plural branch matching algorithm (A2UI Basic Catalog Specification)
 * Accepts value and plural forms (zero, one, two, few, many, other), returns matched string dynamically
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

  // 1. If CLDR / Intl matched category is defined in forms, use directly
  if (category && forms[category] !== undefined) {
    return forms[category];
  }

  // 2. Numeric range and fallback matching for few / many branches when not captured by CLDR rules
  if (category === 'other' || !category) {
    if (num >= 3 && num <= 10 && forms.few !== undefined && forms.other === undefined) {
      return forms.few;
    }
    if (num > 10 && forms.many !== undefined && forms.other === undefined) {
      return forms.many;
    }
  }

  // 3. Fallback to other, or try one if other is omitted
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
 * openUrl specification and WeChat MiniProgram platform fallback
 * Strictly restricted to HTTP/HTTPS URLs; on MiniProgram platform copies to clipboard and shows toast
 */
function openUrl(url) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Invalid URL: must be a non-empty string' };
  }

  const trimmed = url.trim();
  // Strictly restricted to HTTP/HTTPS protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    return { success: false, error: 'Unsupported URL scheme: only HTTP/HTTPS are allowed' };
  }

  // 1. WeChat MiniProgram environment: copy to clipboard and notify via toast
  if (typeof wx !== 'undefined') {
    if (wx.setClipboardData) {
      wx.setClipboardData({
        data: trimmed,
        success: () => {
          if (wx.showToast) {
            wx.showToast({
              title: 'Link copied, please open in browser',
              icon: 'none',
              duration: 2500,
            });
          }
        },
      });
    } else if (wx.showToast) {
      wx.showToast({
        title: 'Link copied, please open in browser',
        icon: 'none',
        duration: 2500,
      });
    }
    mockClipboardData = trimmed;
    mockToast = { title: 'Link copied, please open in browser', icon: 'none' };
    return { success: true, url: trimmed, action: 'copied_to_clipboard' };
  }

  // 2. Browser environment: safe window.open
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(trimmed, '_blank', 'noopener,noreferrer');
    return { success: true, url: trimmed, action: 'window_open' };
  }

  // 3. Node test environment fallback: record clipboard and toast
  mockClipboardData = trimmed;
  mockToast = { title: 'Link copied, please open in browser', icon: 'none' };
  return { success: true, url: trimmed, action: 'copied_to_clipboard' };
}

/**
 * A2UI standard Capability negotiation message generator (following renderer_capabilities.json)
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
 * Evaluates official 15 built-in functions
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
      // Supports numeric string timestamps (e.g. "1730160000000" or 10-digit second timestamps)
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

    // Prevents double execution and injection vulnerabilities (CR-N1)
    case 'formatString': {
      return resolvedArgs.value != null ? String(resolvedArgs.value) : '';
    }

    // Validation and logical functions (supports ValidationResult)
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
      // Text and pattern length limits (max 250 chars text, 200 chars pattern)
      if (typeof pattern !== 'string' || pattern.length > 200) {
        console.warn(`[A2UI Validation] regex pattern invalid or exceeds 200 characters: ${pattern}`);
        return false;
      }
      if (val.length > 250) {
        console.warn(`[A2UI Validation] regex input string length (${val.length}) exceeds safe limit (250 chars). Rejected to prevent ReDoS.`);
        return false;
      }
      // Deep static structure analysis to intercept ReDoS catastrophic backtracking
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
      // Pure function computation: never call side-effect APIs like wx.setClipboardData or wx.showToast during render evaluation
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
