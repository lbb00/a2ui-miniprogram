/**
 * Visual Parity Review Verification Suite
 * 对比官方 Web 演示（Lit / React 渲染器），针对用户反馈的 6 大样式与排版差异展开精准回归验证：
 * 1. complex-layout: caption 斜体与 TextField 移除多余的 placeholder 回退
 * 2. 00_incremental: Button border-radius 对齐官方 8rpx 与嵌套 Column 移除卡片边框阴影
 * 3. row-layout: 右侧 caption 恢复斜体，两端对齐自适应宽度
 * 4. 01_flight-status: 航线 origin / arrow / destination 紧贴自适应 (flex: 0 0 auto)，时间 caption 恢复斜体
 * 5. 02_email-compose: FROM / TO / SUBJECT 与内容自然连贯排布 (flex: 0 0 auto，不再被强制 50% 两栏对齐)
 * 6. 04_weather-current: 高低温两个度数紧贴自适应 (flex: 0 0 auto，不再被强制 50% 分开)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');

console.log('================================================================');
console.log('🎨 开始执行视觉一致性 (Visual Parity) 专项回归验证套件');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. complex-layout 验证
// -----------------------------------------------------------------------------
console.log('👉 [1/6] 验证 00_complex-layout: 移除多余 placeholder 且 caption 包含斜体');
const complexData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/00_complex-layout.json'), 'utf8'));
const complexEngine = new A2UIEngine();
complexEngine.process(complexData.messages);
const complexTree = complexEngine.getRenderTree('gallery-complex-layout');

// 1.1 查找 TextField 节点，验证 placeholder 为 undefined
const firstName = complexTree.children[1].children[0];
const lastName = complexTree.children[1].children[1];
assert.strictEqual(firstName.component, 'TextField');
assert.strictEqual(firstName.label, 'First Name');
assert.strictEqual(firstName.placeholder, undefined, '未定义 placeholder 时不应回退为 label 或默认文字');
assert.strictEqual(lastName.placeholder, undefined);

// 1.2 校验 templates.wxml 中 TextField input 不再包含 i.label 回退
const templatesWxml = fs.readFileSync(path.resolve(__dirname, '../miniprogram/components/a2ui-surface/templates.wxml'), 'utf8');
assert.ok(!templatesWxml.includes('placeholder="{{i.placeholder || i.label'), 'templates.wxml 必须移除 placeholder 回退 i.label');
assert.ok(templatesWxml.includes('placeholder="{{i.placeholder || \'\'}}"'), 'templates.wxml 必须采用 placeholder="{{i.placeholder || \'\'}}"');

// 1.3 校验 footer caption 样式规则
const footer = complexTree.children[2];
assert.strictEqual(footer.variant, 'caption');
const wxssContent = fs.readFileSync(path.resolve(__dirname, '../miniprogram/components/a2ui-surface/a2ui-surface.wxss'), 'utf8');
assert.ok(wxssContent.includes('.a2ui-text-caption') && wxssContent.includes('font-style: italic;'), 'wxss 必须为 .a2ui-text-caption 声明 font-style: italic');
console.log('   ✓ complex-layout 文本斜体与 input 无多余 placeholder 验证通过');

// -----------------------------------------------------------------------------
// 2. 00_incremental 验证
// -----------------------------------------------------------------------------
console.log('\n👉 [2/6] 验证 00_incremental: 按钮圆角 8rpx 与嵌套 Column 移除卡片视觉');
// 2.1 校验按钮圆角对齐官方 --a2ui-border-radius: 0.25rem = 8rpx
assert.ok(wxssContent.includes('border-radius: 8rpx;'), 'Button 基础圆角必须为 8rpx');
assert.ok(!wxssContent.includes('border-radius: 40rpx;'), 'Button 不能为 40rpx 大胶囊圆角');

// 2.2 校验嵌套 Column 不自带 card 背景、边框与阴影
assert.ok(!wxssContent.includes('.a2ui-column > .a2ui-column'), '必须移除 .a2ui-column > .a2ui-column 卡片侵入样式');
console.log('   ✓ incremental 按钮 8rpx 圆角与 Column 布局容器纯净性验证通过');

// -----------------------------------------------------------------------------
// 3. row-layout 验证
// -----------------------------------------------------------------------------
console.log('\n👉 [3/6] 验证 00_row-layout: 右侧 caption 恢复斜体且保持自适应端点对齐');
const rowData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/00_row-layout.json'), 'utf8'));
const rowEngine = new A2UIEngine();
rowEngine.process(rowData.messages);
const rowTree = rowEngine.getRenderTree('gallery-row-layout');
const [leftText, rightText] = rowTree.children;
assert.strictEqual(leftText.text, 'Left Content');
assert.strictEqual(leftText.flexStyle, 'flex: 0 0 auto;');
assert.strictEqual(rightText.text, 'Right Content');
assert.strictEqual(rightText.variant, 'caption');
assert.strictEqual(rightText.flexStyle, 'flex: 0 0 auto;');
assert.strictEqual(rowTree.justify, 'spaceBetween');
console.log('   ✓ row-layout 两端对齐与右侧 caption 斜体验证通过');

// -----------------------------------------------------------------------------
// 4. 01_flight-status 验证
// -----------------------------------------------------------------------------
console.log('\n👉 [4/6] 验证 01_flight-status: Vienna → New York 紧贴自适应 (flex: 0 0 auto) 与日期斜体');
const flightData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/01_flight-status.json'), 'utf8'));
const flightEngine = new A2UIEngine();
flightEngine.process(flightData.messages);
const flightTree = flightEngine.getRenderTree('gallery-flight-status');

// 查找 route_row (Vienna → New York)
const findNodeById = (node, id) => {
  if (!node) return null;
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const match = findNodeById(child, id);
      if (match) return match;
    }
  }
  return null;
};

const routeRow = findNodeById(flightTree, 'route_row');
assert.ok(routeRow, 'route_row 必须存在');
assert.strictEqual(routeRow.children.length, 3);
const [originNode, arrowNode, destNode] = routeRow.children;
assert.strictEqual(originNode.flexStyle, 'flex: 0 0 auto;', 'Vienna 必须为自适应内容宽度 flex: 0 0 auto');
assert.strictEqual(arrowNode.flexStyle, 'flex: 0 0 auto;', '→ 箭头必须为自适应内容宽度 flex: 0 0 auto');
assert.strictEqual(destNode.flexStyle, 'flex: 0 0 auto;', 'New York 必须为自适应内容宽度 flex: 0 0 auto');

// 校验日期 caption 斜体变体
const dateNode = findNodeById(flightTree, 'date');
assert.ok(dateNode, 'date 节点必须存在');
assert.strictEqual(dateNode.variant, 'caption', 'date 应为 caption 变体 (渲染为斜体)');
console.log('   ✓ flight-status 航线三元素紧凑并排与日期 caption 斜体验证通过');

// -----------------------------------------------------------------------------
// 5. 02_email-compose 验证
// -----------------------------------------------------------------------------
console.log('\n👉 [5/6] 验证 02_email-compose: 前三项 FROM / TO / SUBJECT 与内容自然连贯排布');
const emailData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/02_email-compose.json'), 'utf8'));
const emailEngine = new A2UIEngine();
emailEngine.process(emailData.messages);
const emailTree = emailEngine.getRenderTree('gallery-email-compose');

const fromRow = findNodeById(emailTree, 'from_row');
const toRow = findNodeById(emailTree, 'to_row');
const subjectRow = findNodeById(emailTree, 'subject_row');

assert.ok(fromRow && toRow && subjectRow, '前三项 Row 必须均存在');
assert.strictEqual(fromRow.children[0].flexStyle, 'flex: 0 0 auto;', 'FROM label 必须为 flex: 0 0 auto');
assert.strictEqual(fromRow.children[1].flexStyle, 'flex: 0 0 auto;', 'FROM value 必须为 flex: 0 0 auto');
assert.strictEqual(toRow.children[0].flexStyle, 'flex: 0 0 auto;', 'TO label 必须为 flex: 0 0 auto');
assert.strictEqual(toRow.children[1].flexStyle, 'flex: 0 0 auto;', 'TO value 必须为 flex: 0 0 auto');
assert.strictEqual(subjectRow.children[0].flexStyle, 'flex: 0 0 auto;', 'SUBJECT label 必须为 flex: 0 0 auto');
assert.strictEqual(subjectRow.children[1].flexStyle, 'flex: 0 0 auto;', 'SUBJECT value 必须为 flex: 0 0 auto');
console.log('   ✓ email-compose 前三项自然连贯排布验证通过');

// -----------------------------------------------------------------------------
// 6. 04_weather-current 验证
// -----------------------------------------------------------------------------
console.log('\n👉 [6/8] 验证 04_weather-current: 高低两度数紧贴排布 (flex: 0 0 auto)');
const weatherData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/04_weather-current.json'), 'utf8'));
const weatherEngine = new A2UIEngine();
weatherEngine.process(weatherData.messages);
const weatherTree = weatherEngine.getRenderTree('gallery-weather-current');

const tempRow = findNodeById(weatherTree, 'temp_row');
assert.ok(tempRow, 'temp_row 必须存在');
assert.strictEqual(tempRow.children.length, 2);
const [tempHigh, tempLow] = tempRow.children;
assert.strictEqual(tempHigh.flexStyle, 'flex: 0 0 auto;', 'temp_high 必须为自适应内容宽度 flex: 0 0 auto');
assert.strictEqual(tempLow.flexStyle, 'flex: 0 0 auto;', 'temp_low 必须为自适应内容宽度 flex: 0 0 auto');
console.log('   ✓ weather-current 高低温紧贴排布验证通过');

// -----------------------------------------------------------------------------
// 7. 25_contact-card 验证
// -----------------------------------------------------------------------------
console.log('\n👉 [7/8] 验证 25_contact-card: 居中 Column 内部操作按钮行自适应收缩并水平居中');
const contactData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/25_contact-card.json'), 'utf8'));
const contactEngine = new A2UIEngine();
contactEngine.process(contactData.messages);
const contactTree = contactEngine.getRenderTree('gallery-contact-card');

const mainColumn = contactTree.children[0];
assert.strictEqual(mainColumn.align, 'center', 'main_column 必须为 align: center');
const actionsRow = mainColumn.children.find(c => c.sourceId === 'actions' || c.id === 'actions');
assert.ok(actionsRow, 'actions 行容器必须存在');
assert.strictEqual(actionsRow.component, 'Row');
assert.strictEqual(actionsRow.children.length, 2);
assert.strictEqual(actionsRow.children[0].component, 'Button');
assert.strictEqual(actionsRow.children[1].component, 'Button');

// 校验 WXSS 样式约束规则：居中列内的 Row 应收缩为 auto 并水平居中
assert.ok(
  wxssContent.includes('.a2ui-column.a2ui-align-center > .a2ui-row') &&
  wxssContent.includes('width: auto;') &&
  wxssContent.includes('align-self: center;'),
  'wxss 必须声明 .a2ui-column.a2ui-align-center > .a2ui-row { width: auto; align-self: center; }'
);
console.log('   ✓ contact-card 操作按钮行在居中 Column 内水平居中对齐验证通过');

// -----------------------------------------------------------------------------
// 8. 18_track-list 验证
// -----------------------------------------------------------------------------
console.log('\n👉 [8/8] 验证 18_track-list: 标号对齐、缩略图尺寸规约与歌曲信息自动撑满两端对齐');
const trackData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/18_track-list.json'), 'utf8'));
const trackEngine = new A2UIEngine();
trackEngine.process(trackData.messages);
const trackTree = trackEngine.getRenderTree('gallery-track-list');

// 查找首个 track 项
const tracksList = trackTree.children[0].children[2];
assert.strictEqual(tracksList.id, 'tracks_list');
assert.ok(tracksList.children.length > 0, 'tracks_list 应包含动态生成的 track 项');
const firstTrack = tracksList.children[0];
assert.strictEqual(firstTrack.component, 'Row');
assert.strictEqual(firstTrack.children.length, 4);

const [trackNum, trackArt, trackInfo, trackDuration] = firstTrack.children;
assert.strictEqual(trackNum.component, 'Text');
assert.strictEqual(trackNum.text, '1');
assert.strictEqual(trackNum.variant, 'caption');
assert.strictEqual(trackNum.flexStyle, 'flex: 0 0 auto;', '标号列必须为固定宽度自适应 flex: 0 0 auto');

assert.strictEqual(trackArt.component, 'Image');
assert.strictEqual(trackArt.flexStyle, 'flex: 0 0 auto;', '封面缩略图必须为固定自适应 flex: 0 0 auto');

assert.strictEqual(trackInfo.component, 'Column');
assert.strictEqual(trackInfo.flexStyle, 'flex: 1 1 0%; min-width: 0;', '歌曲信息 Column 容器必须自动撑满可用空间 flex: 1 1 0%');

assert.strictEqual(trackDuration.component, 'Text');
assert.strictEqual(trackDuration.text, '8:09');
assert.strictEqual(trackDuration.flexStyle, 'flex: 0 0 auto;', '时长文本必须自适应靠右对齐 flex: 0 0 auto');

// 校验 WXSS 缩略图与标号规约样式
assert.ok(
  wxssContent.includes('.a2ui-row-item .a2ui-image') &&
  wxssContent.includes('width: 88rpx;') &&
  wxssContent.includes('height: 88rpx;'),
  'wxss 必须对 .a2ui-row-item .a2ui-image 约束 88rpx * 88rpx 缩略图尺寸'
);
assert.ok(
  wxssContent.includes('.a2ui-row-item:first-child .a2ui-text-caption') &&
  wxssContent.includes('min-width: 36rpx;'),
  'wxss 必须对 .a2ui-row-item:first-child .a2ui-text-caption 提供标号列宽对齐'
);
console.log('   ✓ track-list 标号规约、缩略图尺寸及歌曲信息弹性两端对齐验证通过');

console.log('\n================================================================');
console.log('🎉 全部 8 项视觉一致性 (Visual Parity) 专项单测 100% PASS！');
console.log('================================================================\n');
