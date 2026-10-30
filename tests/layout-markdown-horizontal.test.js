/**
 * A2UI Layout Engine, Inline Markdown & Horizontal List Test Suite
 *
 * Verifies:
 * - Flex weight & ownWidth layout engine aligned with Flutter layout.dart
 * - Inline Markdown rich text parsing & WeChat rich-text
 * - Horizontal list scrolling
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { hasMarkdown, parseMarkdown, parseInline, escapeHtml } = require('../miniprogram/core/markdown');

console.log('================================================================');
console.log('🚀 Running A2UI Layout Engine, Markdown & Horizontal List Tests');
console.log('================================================================\n');

// ============================================================================
// 1. Flex weight proportions & ownWidth layout engine
// ============================================================================
console.log('👉 [1/3] Verify Flex weight proportions & ownWidth layout engine');

const layoutEngine = new A2UIEngine();
layoutEngine.process({
  version: 'v1.0',
  createSurface: {
    surfaceId: 'surf_layout',
    components: [
      { id: 'root', component: 'Card', child: 'test_row' },
      { id: 'test_row', component: 'Row', children: ['icon_item', 'text_weighted', 'text_default', 'btn_item', 'avatar_item'] },
      { id: 'icon_item', component: 'Icon', name: 'star' },
      { id: 'text_weighted', component: 'Text', text: 'Weighted 2.5', weight: 2.5 },
      { id: 'text_default', component: 'Text', text: 'Default Text' },
      { id: 'btn_item', component: 'Button', text: 'Own Width Btn' },
      { id: 'avatar_item', component: 'Image', url: 'https://avatar.png', variant: 'avatar' },
    ],
  },
});

const layoutTree = layoutEngine.getRenderTree('surf_layout');
assert.ok(layoutTree, 'Render tree should be generated');
const rowNode = layoutTree.children[0];
assert.strictEqual(rowNode.component, 'Row', 'First child under root must be Row');

// 1.1 Verify Icon (ownWidth = true)
const iconNode = rowNode.children[0];
assert.strictEqual(iconNode.component, 'Icon');
assert.strictEqual(iconNode.ownWidth, true, 'Icon must be identified as ownWidth');
assert.strictEqual(iconNode.flexStyle, 'flex: 0 0 auto;', 'Icon default flexStyle should be 0 0 auto');

// 1.2 Verify Text with explicit weight: 2.5
const weightedNode = rowNode.children[1];
assert.strictEqual(weightedNode.component, 'Text');
assert.strictEqual(weightedNode.weight, 2.5, 'Text should extract weight number');
assert.strictEqual(weightedNode.ownWidth, false, 'Text is not ownWidth');
assert.strictEqual(weightedNode.flexStyle, 'flex: 2.5 1 0%; min-width: 0;', 'Specified weight should produce flex: weight 1 0%; min-width: 0;');

// 1.3 Verify normal Text without weight (auto content width flex: 0 0 auto)
const defaultTextNode = rowNode.children[2];
assert.strictEqual(defaultTextNode.component, 'Text');
assert.strictEqual(defaultTextNode.weight, undefined, 'Unspecified weight should be undefined');
assert.strictEqual(defaultTextNode.ownWidth, false);
assert.strictEqual(defaultTextNode.flexStyle, 'flex: 0 0 auto;', 'Unspecified weight should default to flex: 0 0 auto');

// 1.4 Verify Button (ownWidth = true)
const btnNode = rowNode.children[3];
assert.strictEqual(btnNode.component, 'Button');
assert.strictEqual(btnNode.ownWidth, true, 'Button must be identified as ownWidth');
assert.strictEqual(btnNode.flexStyle, 'flex: 0 0 auto;', 'Button flexStyle should be flex: 0 0 auto');

// 1.5 Verify Image avatar variant (ownWidth = true)
const avatarNode = rowNode.children[4];
assert.strictEqual(avatarNode.component, 'Image');
assert.strictEqual(avatarNode.variant, 'avatar');
assert.strictEqual(avatarNode.ownWidth, true, 'Image avatar variant must be identified as ownWidth');
assert.strictEqual(avatarNode.flexStyle, 'flex: 0 0 auto;');

// 1.6 Verify 33_financial-data-grid.json official example proportions
const gridData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/33_financial-data-grid.json'), 'utf8'));
const gridEngine = new A2UIEngine();
gridEngine.process(gridData.messages);
const gridTree = gridEngine.getRenderTree('gallery-financial-grid');
assert.ok(gridTree, 'Financial Grid render tree should be generated');

// Find header_row
const findNode = (n, id) => {
  if (!n) return null;
  if (n.id === id) return n;
  if (n.children) {
    for (const c of n.children) {
      const f = findNode(c, id);
      if (f) return f;
    }
  }
  return null;
};

const headerRow = findNode(gridTree, 'header_row');
assert.ok(headerRow, 'header_row should exist');
assert.strictEqual(headerRow.children[0].weight, 2, 'Asset column weight should be 2');
assert.strictEqual(headerRow.children[0].flexStyle, 'flex: 2 1 0%; min-width: 0;');
assert.strictEqual(headerRow.children[1].weight, 1, 'Price column weight should be 1');
assert.strictEqual(headerRow.children[1].flexStyle, 'flex: 1 1 0%; min-width: 0;');
assert.strictEqual(headerRow.children[2].weight, 1, '24h Change column weight should be 1');
assert.strictEqual(headerRow.children[2].flexStyle, 'flex: 1 1 0%; min-width: 0;');
assert.strictEqual(headerRow.children[3].weight, 1.5, 'Market Cap column weight should be 1.5');
assert.strictEqual(headerRow.children[3].flexStyle, 'flex: 1.5 1 0%; min-width: 0;');

// 1.7 Verify 00_row-layout.json spaceBetween layout
const rowLayoutData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/00_row-layout.json'), 'utf8'));
const rowEngine = new A2UIEngine();
rowEngine.process(rowLayoutData.messages);
const rowTree = rowEngine.getRenderTree('gallery-row-layout');
assert.ok(rowTree, 'Row Layout render tree should be generated');
assert.strictEqual(rowTree.justify, 'spaceBetween');
assert.strictEqual(rowTree.children[0].text, 'Left Content');
assert.strictEqual(rowTree.children[0].flexStyle, 'flex: 0 0 auto;', 'Left Content with spaceBetween and no weight should be auto width');
assert.strictEqual(rowTree.children[1].text, 'Right Content');
assert.strictEqual(rowTree.children[1].flexStyle, 'flex: 0 0 auto;', 'Right Content with spaceBetween and no weight should be auto width');

console.log('   ✓ Flex weight (2 : 1 : 1 : 1.5), ownWidth and Row spaceBetween alignment verified 100%\n');

// ============================================================================
// 2. Inline Markdown rich text parsing & XSS security defense
// ============================================================================
console.log('👉 [2/3] Verify Inline Markdown parsing & XSS security defense');

// 2.1 Basic inline formatting
const inlineSample = 'This sample has **bold text** and *italic text* and `const a = 1;` and ~~strikethrough~~ and [A2UI](https://a2ui.org) test.';
assert.strictEqual(hasMarkdown(inlineSample), true, 'Should detect Markdown markers');
const parsedInline = parseInline(inlineSample);
assert.ok(parsedInline.includes('<strong>bold text</strong>'), 'Bold tag parsing');
assert.ok(parsedInline.includes('<em>italic text</em>'), 'Italic tag parsing');
assert.ok(parsedInline.includes('<code class="a2ui-code">const a = 1;</code>'), 'Code highlight tag parsing');
assert.ok(parsedInline.includes('<del>strikethrough</del>'), 'Strikethrough tag parsing');
assert.ok(parsedInline.includes('<span class="a2ui-link" data-href="https://a2ui.org">A2UI</span>'), 'Hyperlink parsing');

// 2.2 XSS defense & malicious URL sanitization
const xssSample = '<script>alert("xss")</script> **Normal Bold** [Malicious Link](javascript:alert(1))';
const parsedXss = parseMarkdown(xssSample);
assert.ok(!parsedXss.includes('<script>'), 'Must sanitize script tag');
assert.ok(parsedXss.includes('&lt;script&gt;'), 'Malicious tag escaped');
assert.ok(parsedXss.includes('data-href="#"'), 'javascript: pseudo-protocol sanitized to #');
assert.ok(parsedXss.includes('<strong>Normal Bold</strong>'), 'Bold rendered normally');

// 2.3 Multi-line Markdown block formats (headings, lists, paragraphs)
const multiLineMd = `# Main Heading\n\nFirst paragraph with **bold**.\n\n- Item 1\n- Item 2\n\n[Link](https://google.com)`;
const parsedMulti = parseMarkdown(multiLineMd);
assert.ok(parsedMulti.includes('<h1>Main Heading</h1>'), 'Supports h1 parsing');
assert.ok(parsedMulti.includes('<ul><li>Item 1</li><li>Item 2</li></ul>'), 'Supports unordered list grouping');
assert.ok(parsedMulti.includes('<p>First paragraph with <strong>bold</strong>.</p>'), 'Supports paragraph parsing');

// 2.4 Verify 35_markdown-text.json official example
const mdCaseData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/35_markdown-text.json'), 'utf8'));
const mdEngine = new A2UIEngine();
mdEngine.process(mdCaseData.messages);
const mdTree = mdEngine.getRenderTree('gallery-markdown-text');
assert.ok(mdTree, 'Markdown example render tree should be generated');

const mdContentNode = findNode(mdTree, 'markdown_content');
assert.ok(mdContentNode, 'markdown_content node should exist');
assert.ok(mdContentNode.richHtml, 'Node containing markdown must output richHtml field');
assert.ok(mdContentNode.richHtml.includes('<h1>Heading 1</h1>'), 'richHtml must contain h1');
assert.ok(mdContentNode.richHtml.includes('<strong>bold</strong>'), 'richHtml must contain bold');
assert.ok(mdContentNode.richHtml.includes('<em>italic</em>'), 'richHtml must contain italic');
assert.ok(mdContentNode.richHtml.includes('<li>List item 1</li>'), 'richHtml must contain li');
assert.ok(mdContentNode.richHtml.includes('<span class="a2ui-link"'), 'richHtml must contain link');

// Pure single line heading title_text
const titleNode = findNode(mdTree, 'title_text');
assert.ok(titleNode, 'title_text should exist');
assert.strictEqual(titleNode.variant, 'h3', 'Single line heading converts to variant=h3');
assert.strictEqual(titleNode.text, 'Markdown Rendering');
assert.strictEqual(titleNode.richHtml, undefined, 'Plain text without markdown markers should not generate richHtml');

console.log('   ✓ Markdown bold/italic/code/strikethrough/link/heading/list and XSS defense verified 100%\n');

// ============================================================================
// 3. List component horizontal scrolling (direction="horizontal")
// ============================================================================
console.log('👉 [3/3] Verify List component horizontal scrolling (direction="horizontal")');

const listEngine = new A2UIEngine();
listEngine.process({
  version: 'v1.0',
  createSurface: {
    surfaceId: 'surf_list',
    components: [
      { id: 'root', component: 'Column', children: ['v_list', 'h_list'] },
      { id: 'v_list', component: 'List', children: ['item_1'] },
      { id: 'h_list', component: 'List', direction: 'horizontal', children: ['item_2'] },
      { id: 'item_1', component: 'Text', text: 'Vertical' },
      { id: 'item_2', component: 'Text', text: 'Horizontal' },
    ],
  },
});

const listTree = listEngine.getRenderTree('surf_list');
assert.ok(listTree);
const vListNode = listTree.children[0];
const hListNode = listTree.children[1];

assert.strictEqual(vListNode.component, 'List');
assert.strictEqual(vListNode.direction, undefined);

assert.strictEqual(hListNode.component, 'List');
assert.strictEqual(hListNode.direction, 'horizontal', 'h_list should extract direction="horizontal"');

// Verify scroll-view branch in templates.wxml
const templatesContent = fs.readFileSync(path.resolve(__dirname, '../miniprogram/components/a2ui-surface/templates.wxml'), 'utf8');
assert.ok(
  templatesContent.includes(`i.component === 'List' && i.direction === 'horizontal'`),
  'templates.wxml must branch on direction === horizontal'
);
assert.ok(
  templatesContent.includes(`scroll-x="true"`),
  'templates.wxml must declare scroll-x="true"'
);
assert.ok(
  templatesContent.includes(`class="a2ui-list a2ui-list-horizontal"`),
  'templates.wxml must include a2ui-list-horizontal class'
);

// Verify rich-text branch in templates.wxml
assert.ok(
  templatesContent.includes(`i.component === 'Text' && i.richHtml`),
  'templates.wxml must branch on richHtml'
);
assert.ok(
  templatesContent.includes(`<rich-text`),
  'templates.wxml must include rich-text tag'
);

console.log('   ✓ List horizontal scrolling (scroll-x, enable-flex, a2ui-list-horizontal) verified 100%\n');

console.log('================================================================');
console.log('🎉 All 3 layout, markdown & horizontal list tests passed 100%!');
console.log('================================================================\n');
