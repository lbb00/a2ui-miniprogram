/**
 * Visual Parity Review Verification Suite
 *
 * Verifies parity with official web renderer (Lit / React):
 * 1. complex-layout: italic caption & removal of redundant placeholder fallbacks
 * 2. 00_incremental: Button border-radius 8rpx & nested Column without card borders/shadows
 * 3. row-layout: italic caption & spaceBetween auto width alignment
 * 4. 01_flight-status: route origin / arrow / destination auto width (flex: 0 0 auto) & date caption
 * 5. 02_email-compose: FROM / TO / SUBJECT auto width alignment
 * 6. 04_weather-current: temperature values auto width alignment
 * 7. 25_contact-card: centered Column action buttons auto width & alignment
 * 8. 18_track-list: index alignment, thumbnail dimensions & flex-grow track info
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { A2UIEngine } = require('../miniprogram/core/engine');

console.log('================================================================');
console.log('🎨 Running Visual Parity Regression Verification Suite');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. complex-layout verification
// -----------------------------------------------------------------------------
console.log('👉 [1/6] Verify 00_complex-layout: remove redundant placeholder fallback & italic caption');
const complexData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/00_complex-layout.json'), 'utf8'));
const complexEngine = new A2UIEngine();
complexEngine.process(complexData.messages);
const complexTree = complexEngine.getRenderTree('gallery-complex-layout');

// 1.1 Check TextField placeholder is undefined
const firstName = complexTree.children[1].children[0];
const lastName = complexTree.children[1].children[1];
assert.strictEqual(firstName.component, 'TextField');
assert.strictEqual(firstName.label, 'First Name');
assert.strictEqual(firstName.placeholder, undefined, 'Undefined placeholder should not fall back to label');
assert.strictEqual(lastName.placeholder, undefined);

// 1.2 Verify templates.wxml input does not fall back to label
const templatesWxml = fs.readFileSync(path.resolve(__dirname, '../miniprogram/components/a2ui-surface/templates.wxml'), 'utf8');
assert.ok(!templatesWxml.includes('placeholder="{{i.placeholder || i.label'), 'templates.wxml must remove placeholder fallback i.label');
assert.ok(templatesWxml.includes('placeholder="{{i.placeholder || \'\'}}"'), 'templates.wxml must use placeholder="{{i.placeholder || \'\'}}"');

// 1.3 Verify footer caption style rule
const footer = complexTree.children[2];
assert.strictEqual(footer.variant, 'caption');
const wxssContent = fs.readFileSync(path.resolve(__dirname, '../miniprogram/components/a2ui-surface/a2ui-surface.wxss'), 'utf8');
assert.ok(wxssContent.includes('.a2ui-text-caption') && wxssContent.includes('font-style: italic;'), 'wxss must declare font-style: italic for .a2ui-text-caption');
console.log('   ✓ complex-layout italic text & placeholder verified');

// -----------------------------------------------------------------------------
// 2. 00_incremental verification
// -----------------------------------------------------------------------------
console.log('\n👉 [2/6] Verify 00_incremental: button border-radius 8rpx & nested Column without card styles');
// 2.1 Verify button border-radius 8rpx (0.25rem)
assert.ok(wxssContent.includes('border-radius: 8rpx;'), 'Button border-radius must be 8rpx');
assert.ok(!wxssContent.includes('border-radius: 40rpx;'), 'Button cannot have 40rpx pill radius');

// 2.2 Verify nested Column has no card background, border, or shadow
assert.ok(!wxssContent.includes('.a2ui-column > .a2ui-column'), 'Must not apply card styles to nested columns');
console.log('   ✓ incremental button 8rpx radius & pure Column layout container verified');

// -----------------------------------------------------------------------------
// 3. row-layout verification
// -----------------------------------------------------------------------------
console.log('\n👉 [3/6] Verify 00_row-layout: right caption italic & spaceBetween auto alignment');
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
console.log('   ✓ row-layout alignment & right caption italic verified');

// -----------------------------------------------------------------------------
// 4. 01_flight-status verification
// -----------------------------------------------------------------------------
console.log('\n👉 [4/6] Verify 01_flight-status: Vienna -> New York auto layout & date caption');
const flightData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/01_flight-status.json'), 'utf8'));
const flightEngine = new A2UIEngine();
flightEngine.process(flightData.messages);
const flightTree = flightEngine.getRenderTree('gallery-flight-status');

// Find route_row
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
assert.ok(routeRow, 'route_row must exist');
assert.strictEqual(routeRow.children.length, 3);
const [originNode, arrowNode, destNode] = routeRow.children;
assert.strictEqual(originNode.flexStyle, 'flex: 0 0 auto;', 'Vienna must be flex: 0 0 auto');
assert.strictEqual(arrowNode.flexStyle, 'flex: 0 0 auto;', 'Arrow must be flex: 0 0 auto');
assert.strictEqual(destNode.flexStyle, 'flex: 0 0 auto;', 'New York must be flex: 0 0 auto');

// Verify date caption
const dateNode = findNodeById(flightTree, 'date');
assert.ok(dateNode, 'date node must exist');
assert.strictEqual(dateNode.variant, 'caption', 'date must be caption variant');
console.log('   ✓ flight-status route elements & date caption verified');

// -----------------------------------------------------------------------------
// 5. 02_email-compose verification
// -----------------------------------------------------------------------------
console.log('\n👉 [5/6] Verify 02_email-compose: FROM / TO / SUBJECT auto width alignment');
const emailData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/02_email-compose.json'), 'utf8'));
const emailEngine = new A2UIEngine();
emailEngine.process(emailData.messages);
const emailTree = emailEngine.getRenderTree('gallery-email-compose');

const fromRow = findNodeById(emailTree, 'from_row');
const toRow = findNodeById(emailTree, 'to_row');
const subjectRow = findNodeById(emailTree, 'subject_row');

assert.ok(fromRow && toRow && subjectRow, 'All three rows must exist');
assert.strictEqual(fromRow.children[0].flexStyle, 'flex: 0 0 auto;', 'FROM label must be flex: 0 0 auto');
assert.strictEqual(fromRow.children[1].flexStyle, 'flex: 0 0 auto;', 'FROM value must be flex: 0 0 auto');
assert.strictEqual(toRow.children[0].flexStyle, 'flex: 0 0 auto;', 'TO label must be flex: 0 0 auto');
assert.strictEqual(toRow.children[1].flexStyle, 'flex: 0 0 auto;', 'TO value must be flex: 0 0 auto');
assert.strictEqual(subjectRow.children[0].flexStyle, 'flex: 0 0 auto;', 'SUBJECT label must be flex: 0 0 auto');
assert.strictEqual(subjectRow.children[1].flexStyle, 'flex: 0 0 auto;', 'SUBJECT value must be flex: 0 0 auto');
console.log('   ✓ email-compose rows auto width alignment verified');

// -----------------------------------------------------------------------------
// 6. 04_weather-current verification
// -----------------------------------------------------------------------------
console.log('\n👉 [6/8] Verify 04_weather-current: temperature values auto width alignment (flex: 0 0 auto)');
const weatherData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/04_weather-current.json'), 'utf8'));
const weatherEngine = new A2UIEngine();
weatherEngine.process(weatherData.messages);
const weatherTree = weatherEngine.getRenderTree('gallery-weather-current');

const tempRow = findNodeById(weatherTree, 'temp_row');
assert.ok(tempRow, 'temp_row must exist');
assert.strictEqual(tempRow.children.length, 2);
const [tempHigh, tempLow] = tempRow.children;
assert.strictEqual(tempHigh.flexStyle, 'flex: 0 0 auto;', 'temp_high must be flex: 0 0 auto');
assert.strictEqual(tempLow.flexStyle, 'flex: 0 0 auto;', 'temp_low must be flex: 0 0 auto');
console.log('   ✓ weather-current temperatures auto width verified');

// -----------------------------------------------------------------------------
// 7. 25_contact-card verification
// -----------------------------------------------------------------------------
console.log('\n👉 [7/8] Verify 25_contact-card: centered Column actions row auto width & alignment');
const contactData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/25_contact-card.json'), 'utf8'));
const contactEngine = new A2UIEngine();
contactEngine.process(contactData.messages);
const contactTree = contactEngine.getRenderTree('gallery-contact-card');

const mainColumn = contactTree.children[0];
assert.strictEqual(mainColumn.align, 'center', 'main_column must be align: center');
const actionsRow = mainColumn.children.find(c => c.sourceId === 'actions' || c.id === 'actions');
assert.ok(actionsRow, 'actions row container must exist');
assert.strictEqual(actionsRow.component, 'Row');
assert.strictEqual(actionsRow.children.length, 2);
assert.strictEqual(actionsRow.children[0].component, 'Button');
assert.strictEqual(actionsRow.children[1].component, 'Button');

// Verify WXSS rule for centered Column child row
assert.ok(
  wxssContent.includes('.a2ui-column.a2ui-align-center > .a2ui-row') &&
  wxssContent.includes('width: auto;') &&
  wxssContent.includes('align-self: center;'),
  'wxss must declare .a2ui-column.a2ui-align-center > .a2ui-row { width: auto; align-self: center; }'
);
console.log('   ✓ contact-card actions row centered alignment verified');

// -----------------------------------------------------------------------------
// 8. 18_track-list verification
// -----------------------------------------------------------------------------
console.log('\n👉 [8/8] Verify 18_track-list: index alignment, thumbnail dimensions & track info expansion');
const trackData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/official-examples/18_track-list.json'), 'utf8'));
const trackEngine = new A2UIEngine();
trackEngine.process(trackData.messages);
const trackTree = trackEngine.getRenderTree('gallery-track-list');

// Find first track item
const tracksList = trackTree.children[0].children[2];
assert.strictEqual(tracksList.id, 'tracks_list');
assert.ok(tracksList.children.length > 0, 'tracks_list should contain track items');
const firstTrack = tracksList.children[0];
assert.strictEqual(firstTrack.component, 'Row');
assert.strictEqual(firstTrack.children.length, 4);

const [trackNum, trackArt, trackInfo, trackDuration] = firstTrack.children;
assert.strictEqual(trackNum.component, 'Text');
assert.strictEqual(trackNum.text, '1');
assert.strictEqual(trackNum.variant, 'caption');
assert.strictEqual(trackNum.flexStyle, 'flex: 0 0 auto;', 'Index column must be flex: 0 0 auto');

assert.strictEqual(trackArt.component, 'Image');
assert.strictEqual(trackArt.flexStyle, 'flex: 0 0 auto;', 'Album art thumbnail must be flex: 0 0 auto');

assert.strictEqual(trackInfo.component, 'Column');
assert.strictEqual(trackInfo.flexStyle, 'flex: 1 1 0%; min-width: 0;', 'Track info Column must expand with flex: 1 1 0%');

assert.strictEqual(trackDuration.component, 'Text');
assert.strictEqual(trackDuration.text, '8:09');
assert.strictEqual(trackDuration.flexStyle, 'flex: 0 0 auto;', 'Duration text must be flex: 0 0 auto');

// Verify WXSS thumbnail and index rules
assert.ok(
  wxssContent.includes('.a2ui-row-item .a2ui-image') &&
  wxssContent.includes('width: 88rpx;') &&
  wxssContent.includes('height: 88rpx;'),
  'wxss must constrain thumbnail dimensions to 88rpx * 88rpx'
);
assert.ok(
  wxssContent.includes('.a2ui-row-item:first-child .a2ui-text-caption') &&
  wxssContent.includes('min-width: 36rpx;'),
  'wxss must constrain index column alignment'
);
console.log('   ✓ track-list index alignment, thumbnail dimensions & track info expansion verified');

console.log('\n================================================================');
console.log('🎉 All 8 Visual Parity tests passed 100%!');
console.log('================================================================\n');
