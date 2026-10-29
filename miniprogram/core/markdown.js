/**
 * A2UI Lightweight & Safe Markdown AST / HTML Parser for WeChat MiniProgram
 * Supports inline formatting: bold, italic, inline code, strikethrough, links
 * Supports block formatting: headings (#..######), lists (- / * / 1.), paragraphs, blockquotes
 * Built-in XSS defense, URL sanitization, and intra-word underscore protection
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url) return '';
  // Normalize any pre-escaped ampersands to avoid double escaping & -> &amp; -> &amp;amp;
  const decoded = String(url).trim().replace(/[\x00-\x1f\x7f]/g, '').replace(/&amp;/g, '&');
  if (/^(javascript|vbscript|data):/i.test(decoded)) {
    return '#';
  }
  return escapeHtml(decoded);
}

/**
 * Check if text contains markdown syntax
 */
function hasMarkdown(text) {
  if (typeof text !== 'string' || !text.trim()) return false;

  // Code block markers
  if (/```[\s\S]*?```/.test(text)) return true;

  // Inline markers
  if (/\*\*[^*]+?\*\*/.test(text)) return true; // **bold**
  if (/~~[^~]+?~~/.test(text)) return true;     // ~~del~~
  if (/`[^`]+?`/.test(text)) return true;       // `code`
  if (/\[[^\]]+?\]\([^)]+?\)/.test(text)) return true; // [link](url)
  if (/(?:^|[^*])\*[^*\s][^*]*?\*(?!\*)/.test(text)) return true; // *italic*
  if (/(?:^|[^\w])_[^_\s][^_]*?_(?=[^\w]|$)/.test(text)) return true; // _italic_

  // Block markers
  if (/^#{1,6}\s+/m.test(text)) return true;   // # Heading
  if (/^[-*]\s+/m.test(text)) return true;     // - List
  if (/^\d+\.\s+/m.test(text)) return true;    // 1. Ordered list
  if (/^>\s+/m.test(text)) return true;        // > Quote

  return false;
}

/**
 * Parse inline markdown formatting safely
 */
function parseInline(rawText) {
  if (!rawText) return '';

  const nonce = Math.random().toString(36).slice(2, 8);
  const codeTokens = [];
  // 1. Extract inline code blocks first so their contents are never altered by other formatting
  let text = rawText.replace(/`([^`]+?)`/g, (_, code) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code class="a2ui-code">${escapeHtml(code)}</code>`);
    return `\x00A2UICODE_${nonce}_${idx}\x00`;
  });

  // 2. Escape any raw HTML tags to prevent XSS
  text = escapeHtml(text);

  // 3. Links: [text](url) -> <span class="a2ui-link" data-href="url">text</span>
  text = text.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (_, linkText, url) => {
    const safeUrl = sanitizeUrl(url);
    return `<span class="a2ui-link" data-href="${safeUrl}">${linkText}</span>`;
  });

  // 4. Bold + Italic: ***text*** or ___text___
  text = text.replace(/\*\*\*([^*]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___([^_]+?)___/g, '<strong><em>$1</em></strong>');

  // 5. Bold: **text** or __text__
  text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+?)__/g, '<strong>$1</strong>');

  // 6. Strikethrough: ~~text~~
  text = text.replace(/~~([^~]+?)~~/g, '<del>$1</del>');

  // 7. Italic: *text* or _text_ (non-word boundary for underscores)
  text = text.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^\w])_([^_]+?)_(?=[^\w]|$)/g, '$1<em>$2</em>');

  // 8. Restore inline code
  text = text.replace(new RegExp(`\\x00A2UICODE_${nonce}_(\\d+)\\x00`, 'g'), (_, idx) => codeTokens[Number(idx)] || '');

  return text;
}

/**
 * Parse markdown into safe HTML string suitable for WeChat rich-text
 */
function parseMarkdown(text) {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  const lines = text.split(/\r?\n/);
  const isMultiLine = lines.length > 1;
  const hasBlockPrefix = /^(?:#{1,6}\s+|[-*]\s+|\d+\.\s+|>)/.test(trimmed);

  // Single line without block markers: return inline HTML directly
  if (!isMultiLine && !hasBlockPrefix && !trimmed.startsWith('```')) {
    return parseInline(trimmed);
  }

  const result = [];
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;
  let inCodeBlock = false;
  let currentCodeBlock = [];
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      result.push(`<p>${currentParagraph.join('<br/>')}</p>`);
      currentParagraph = [];
    }
  };

  const closeList = () => {
    if (inUl) {
      result.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      result.push('</ol>');
      inOl = false;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      result.push('</blockquote>');
      inBlockquote = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTrim = line.trim();

    // Fenced code block (```)
    if (lineTrim.startsWith('```')) {
      if (inCodeBlock) {
        result.push(`<pre class="a2ui-pre"><code class="a2ui-code-block">${escapeHtml(currentCodeBlock.join('\n'))}</code></pre>`);
        currentCodeBlock = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        closeList();
        closeBlockquote();
        inCodeBlock = true;
        currentCodeBlock = [];
      }
      continue;
    }

    if (inCodeBlock) {
      currentCodeBlock.push(line);
      continue;
    }

    // Blank line indicates paragraph / block separation
    if (!lineTrim) {
      flushParagraph();
      closeList();
      closeBlockquote();
      continue;
    }

    // Heading: # .. ######
    const headingMatch = lineTrim.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      closeBlockquote();
      const level = headingMatch[1].length;
      result.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list: - or *
    const ulMatch = lineTrim.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      closeBlockquote();
      if (inOl) closeList();
      if (!inUl) {
        result.push('<ul>');
        inUl = true;
      }
      result.push(`<li>${parseInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list: 1.
    const olMatch = lineTrim.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      closeBlockquote();
      if (inUl) closeList();
      if (!inOl) {
        result.push('<ol>');
        inOl = true;
      }
      result.push(`<li>${parseInline(olMatch[1])}</li>`);
      continue;
    }

    // Blockquote: >
    const bqMatch = lineTrim.match(/^>\s*(.*)$/);
    if (bqMatch) {
      flushParagraph();
      closeList();
      if (!inBlockquote) {
        result.push('<blockquote>');
        inBlockquote = true;
      }
      result.push(`<p>${parseInline(bqMatch[1])}</p>`);
      continue;
    }

    // Normal text line inside a paragraph
    closeList();
    closeBlockquote();
    currentParagraph.push(parseInline(lineTrim));
  }

  if (inCodeBlock) {
    result.push(`<pre class="a2ui-pre"><code class="a2ui-code-block">${escapeHtml(currentCodeBlock.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  closeList();
  closeBlockquote();

  return result.join('');
}

module.exports = {
  hasMarkdown,
  parseMarkdown,
  parseInline,
  escapeHtml,
  sanitizeUrl,
};
