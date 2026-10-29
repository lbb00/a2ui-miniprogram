/**
 * A2UI Layout Engine, Inline Markdown & Horizontal List Test Suite
 * 验证对齐 Flutter layout.dart 的 Flex weight & ownWidth 布局引擎、
 * Inline Markdown 富文本解析与微信 rich-text、
 * 以及 List 横向滚动能力
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');
const { hasMarkdown, parseMarkdown, parseInline, escapeHtml } = require('../miniprogram/core/markdown');

console.log('================================================================');
console.log('🚀 开始执行 A2UI 布局引擎、Markdown 富文本与横向列表专项测试');
console.log('================================================================\n');

// ============================================================================
// 1. 测试 Flex weight 比例自适应与 ownWidth 布局引擎
// ============================================================================
console.log('👉 [1/3] 验证 Flex weight 比例自适应与 ownWidth 布局引擎');

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
assert.ok(layoutTree, '渲染树应成功构建');
const rowNode = layoutTree.children[0];
assert.strictEqual(rowNode.component, 'Row', '根下第一个子节点应为 Row');

// 1.1 校验 Icon (ownWidth = true)
const iconNode = rowNode.children[0];
assert.strictEqual(iconNode.component, 'Icon');
assert.strictEqual(iconNode.ownWidth, true, 'Icon 必须被识别为 ownWidth');
assert.strictEqual(iconNode.flexStyle, 'flex: 0 0 auto;', 'Icon 缺省 flexStyle 应为 0 0 auto');

// 1.2 校验指定 weight: 2.5 的 Text
const weightedNode = rowNode.children[1];
assert.strictEqual(weightedNode.component, 'Text');
assert.strictEqual(weightedNode.weight, 2.5, 'Text 应提取精确的 weight 数值');
assert.strictEqual(weightedNode.ownWidth, false, 'Text 不属于 ownWidth');
assert.strictEqual(weightedNode.flexStyle, 'flex: 2.5 1 0%; min-width: 0;', '指定 weight 应生成 flex: weight 1 0%; min-width: 0;');

// 1.3 校验未指定 weight 的常规 Text (自适应内容宽度 flex: 0 0 auto)
const defaultTextNode = rowNode.children[2];
assert.strictEqual(defaultTextNode.component, 'Text');
assert.strictEqual(defaultTextNode.weight, undefined, '未指定 weight 应为 undefined');
assert.strictEqual(defaultTextNode.ownWidth, false);
assert.strictEqual(defaultTextNode.flexStyle, 'flex: 0 0 auto;', '未指定 weight 的常规项应自适应内容宽度 flex: 0 0 auto');

// 1.4 校验 Button (ownWidth = true)
const btnNode = rowNode.children[3];
assert.strictEqual(btnNode.component, 'Button');
assert.strictEqual(btnNode.ownWidth, true, 'Button 必须识别为 ownWidth');
assert.strictEqual(btnNode.flexStyle, 'flex: 0 0 auto;', 'Button 应为 flex: 0 0 auto');

// 1.5 校验 Image avatar 变体 (ownWidth = true)
const avatarNode = rowNode.children[4];
assert.strictEqual(avatarNode.component, 'Image');
assert.strictEqual(avatarNode.variant, 'avatar');
assert.strictEqual(avatarNode.ownWidth, true, 'Image avatar 变体必须识别为 ownWidth');
assert.strictEqual(avatarNode.flexStyle, 'flex: 0 0 auto;');

// 1.6 校验 33_financial-data-grid.json 官方用例比例完整性
const gridData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/33_financial-data-grid.json'), 'utf8'));
const gridEngine = new A2UIEngine();
gridEngine.process(gridData.messages);
const gridTree = gridEngine.getRenderTree('gallery-financial-grid');
assert.ok(gridTree, 'Financial Grid 渲染树应构建成功');

// 查找 header_row
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
assert.ok(headerRow, 'header_row 应存在');
assert.strictEqual(headerRow.children[0].weight, 2, 'Asset 列应占 2 份');
assert.strictEqual(headerRow.children[0].flexStyle, 'flex: 2 1 0%; min-width: 0;');
assert.strictEqual(headerRow.children[1].weight, 1, 'Price 列应占 1 份');
assert.strictEqual(headerRow.children[1].flexStyle, 'flex: 1 1 0%; min-width: 0;');
assert.strictEqual(headerRow.children[2].weight, 1, '24h Change 列应占 1 份');
assert.strictEqual(headerRow.children[2].flexStyle, 'flex: 1 1 0%; min-width: 0;');
assert.strictEqual(headerRow.children[3].weight, 1.5, 'Market Cap 列应占 1.5 份');
assert.strictEqual(headerRow.children[3].flexStyle, 'flex: 1.5 1 0%; min-width: 0;');

// 1.7 校验 00_row-layout.json 官方用例中 spaceBetween 布局下 Right Content 维持 flex: 0 0 auto，实现真正的两端端点对齐
const rowLayoutData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/00_row-layout.json'), 'utf8'));
const rowEngine = new A2UIEngine();
rowEngine.process(rowLayoutData.messages);
const rowTree = rowEngine.getRenderTree('gallery-row-layout');
assert.ok(rowTree, 'Row Layout 渲染树应构建成功');
assert.strictEqual(rowTree.justify, 'spaceBetween');
assert.strictEqual(rowTree.children[0].text, 'Left Content');
assert.strictEqual(rowTree.children[0].flexStyle, 'flex: 0 0 auto;', 'Left Content 在 spaceBetween 且无 weight 时应自适应宽度');
assert.strictEqual(rowTree.children[1].text, 'Right Content');
assert.strictEqual(rowTree.children[1].flexStyle, 'flex: 0 0 auto;', 'Right Content 在 spaceBetween 且无 weight 时应自适应宽度以贴齐右边缘');

console.log('   ✓ Flex weight (2 : 1 : 1 : 1.5)、ownWidth 与 Row spaceBetween 端点对齐校验 100% 通过\n');

// ============================================================================
// 2. 测试 Inline Markdown 富文本解析与 XSS 安全防御
// ============================================================================
console.log('👉 [2/3] 验证 Inline Markdown 富文本解析与 XSS 安全防御');

// 2.1 基础内联格式测试
const inlineSample = '这是一段包含 **加粗文本** 与 *斜体文本* 以及 `const a = 1;` 和 ~~删除线~~ 还有 [A2UI官网](https://a2ui.org) 的测试。';
assert.strictEqual(hasMarkdown(inlineSample), true, '应精准检测到 Markdown 标记');
const parsedInline = parseInline(inlineSample);
assert.ok(parsedInline.includes('<strong>加粗文本</strong>'), '加粗标签解析');
assert.ok(parsedInline.includes('<em>斜体文本</em>'), '斜体标签解析');
assert.ok(parsedInline.includes('<code class="a2ui-code">const a = 1;</code>'), '代码高亮标签解析');
assert.ok(parsedInline.includes('<del>删除线</del>'), '删除线标签解析');
assert.ok(parsedInline.includes('<span class="a2ui-link" data-href="https://a2ui.org">A2UI官网</span>'), '超链接解析');

// 2.2 XSS 防御与恶意 URL 过滤
const xssSample = '<script>alert("xss")</script> **正常加粗** [恶意链接](javascript:alert(1))';
const parsedXss = parseMarkdown(xssSample);
assert.ok(!parsedXss.includes('<script>'), '必须防御 script 标签');
assert.ok(parsedXss.includes('&lt;script&gt;'), '恶意标签转义');
assert.ok(parsedXss.includes('data-href="#"'), 'javascript: 伪协议应被清洗为 #');
assert.ok(parsedXss.includes('<strong>正常加粗</strong>'), '加粗正常渲染');

// 2.3 多行 Markdown 块级格式 (标题、无序列表、段落)
const multiLineMd = `# 主标题\n\n正文第一段带有 **加粗**。\n\n- 列表项一\n- 列表项二\n\n[链接](https://google.com)`;
const parsedMulti = parseMarkdown(multiLineMd);
assert.ok(parsedMulti.includes('<h1>主标题</h1>'), '支持 h1 解析');
assert.ok(parsedMulti.includes('<ul><li>列表项一</li><li>列表项二</li></ul>'), '支持列表分组解析');
assert.ok(parsedMulti.includes('<p>正文第一段带有 <strong>加粗</strong>。</p>'), '支持段落解析');

// 2.4 验证 35_markdown-text.json 官方用例
const mdCaseData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/35_markdown-text.json'), 'utf8'));
const mdEngine = new A2UIEngine();
mdEngine.process(mdCaseData.messages);
const mdTree = mdEngine.getRenderTree('gallery-markdown-text');
assert.ok(mdTree, 'Markdown 用例渲染树应构建成功');

const mdContentNode = findNode(mdTree, 'markdown_content');
assert.ok(mdContentNode, 'markdown_content 节点应存在');
assert.ok(mdContentNode.richHtml, '含有 markdown 的节点必须输出 richHtml 字段');
assert.ok(mdContentNode.richHtml.includes('<h1>Heading 1</h1>'), 'richHtml 必须包含 h1');
assert.ok(mdContentNode.richHtml.includes('<strong>bold</strong>'), 'richHtml 必须包含 bold');
assert.ok(mdContentNode.richHtml.includes('<em>italic</em>'), 'richHtml 必须包含 italic');
assert.ok(mdContentNode.richHtml.includes('<li>List item 1</li>'), 'richHtml 必须包含 li');
assert.ok(mdContentNode.richHtml.includes('<span class="a2ui-link"'), 'richHtml 必须包含 link');

// 纯单行标题 title_text
const titleNode = findNode(mdTree, 'title_text');
assert.ok(titleNode, 'title_text 应存在');
assert.strictEqual(titleNode.variant, 'h3', '纯单行标题快捷转为 variant=h3');
assert.strictEqual(titleNode.text, 'Markdown Rendering');
assert.strictEqual(titleNode.richHtml, undefined, '纯单行文本无内联标记不应生成 richHtml');

console.log('   ✓ Markdown 加粗/斜体/代码/删除线/链接/标题/列表与 XSS 防护 100% 通过\n');

// ============================================================================
// 3. 测试 List 组件横向滚动 (direction="horizontal")
// ============================================================================
console.log('👉 [3/3] 验证 List 组件横向滚动 (direction="horizontal")');

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
assert.strictEqual(hListNode.direction, 'horizontal', 'h_list 应正确提取 direction="horizontal"');

// 校验 templates.wxml 模板中存在 scroll-view 横向滚动分支
const templatesContent = fs.readFileSync(path.resolve(__dirname, '../miniprogram/components/a2ui-surface/templates.wxml'), 'utf8');
assert.ok(
  templatesContent.includes(`i.component === 'List' && i.direction === 'horizontal'`),
  'templates.wxml 必须包含 direction === horizontal 的分支判断'
);
assert.ok(
  templatesContent.includes(`scroll-x="true"`),
  'templates.wxml 必须声明 scroll-x="true"'
);
assert.ok(
  templatesContent.includes(`class="a2ui-list a2ui-list-horizontal"`),
  'templates.wxml 必须带有 a2ui-list-horizontal 样式类'
);

// 校验 rich-text 模板分支存在
assert.ok(
  templatesContent.includes(`i.component === 'Text' && i.richHtml`),
  'templates.wxml 必须包含 rich-text 分支判断'
);
assert.ok(
  templatesContent.includes(`<rich-text`),
  'templates.wxml 必须生成 rich-text 标签'
);

console.log('   ✓ List 横向滚动 (scroll-x, enable-flex, a2ui-list-horizontal) 校验 100% 通过\n');

console.log('================================================================');
console.log('🎉 全部 3 大专项核心能力测试 100% PASS！');
console.log('================================================================\n');
