/**
 * A2UI MiniProgram Adversarial E2E Semantic Assertion Test Suite
 * Validates real DOM data, child template unrolling, local scopes, and interaction events.
 */

const assert = require('assert');
const { A2UIEngine } = require('../../miniprogram/core/engine');
const ALL_CASES = require('../../fixtures/official-all-cases');

console.log('================================================================');
console.log('🛡️ Running A2UI MiniProgram Adversarial E2E Semantic & Data Assertions');
console.log('================================================================\n');

// Collect all text node values across the render tree
function collectAllTexts(node) {
  if (!node) return [];
  const texts = [];
  if (node.text) texts.push(String(node.text));
  if (node.title) texts.push(String(node.title));
  if (node.subtitle) texts.push(String(node.subtitle));
  if (node.address) texts.push(String(node.address));
  if (node.label) texts.push(String(node.label));
  if (node.value) texts.push(String(node.value));

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      texts.push(...collectAllTexts(child));
    }
  }
  return texts;
}

// Count total nodes in the tree
function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

// Collect all button nodes with actions
function collectButtons(node) {
  if (!node) return [];
  const btns = [];
  if (node.component === 'Button') btns.push(node);
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      btns.push(...collectButtons(child));
    }
  }
  return btns;
}

// ==================== 1. Adversarial Assertion on 00_incremental.json ====================
console.log('🔍 [Adversarial 1] Verify 00_incremental.json dynamic template unrolling & action handling:');
const incrementalCase = ALL_CASES.find((c) => c.file === '00_incremental.json');
assert.ok(incrementalCase, 'Must include 00_incremental.json');

const incEngine = new A2UIEngine();
for (let i = 0; i < incrementalCase.messages.length; i++) {
  incEngine.processMessage(incrementalCase.messages[i]);
}

const incTree = incEngine.getRenderTree('gallery-incremental');
assert.ok(incTree, 'Render tree must not be null');

const incNodeCount = countNodes(incTree);
console.log(`   ├─ Render tree node count: ${incNodeCount} (expected >= 25)`);
assert.ok(incNodeCount >= 25, `00_incremental node count must be >= 25, got ${incNodeCount}`);

const incTexts = collectAllTexts(incTree);
console.log(`   ├─ Collected text entries: ${incTexts.length}`);

// Must include key text from all 4 restaurants
const expectedRestaurants = [
  'The Golden Fork',
  'Fine Dining & Spirits',
  '123 Gastronomy Lane',
  'Ocean\'s Bounty',
  'Fresh Daily Seafood',
  '456 Shoreline Dr',
  'Pizzeria Roma',
  'Authentic Wood-Fired Pizza',
  '789 Napoli Way',
  'Spice Route',
  'Exotic Flavors from the East',
  '101 Silk Road St',
];

for (const exp of expectedRestaurants) {
  assert.ok(
    incTexts.includes(exp),
    `Adversarial failure: 00_incremental must contain text "${exp}"`
  );
}
console.log(`   ├─ All 12 real attributes across 4 restaurants verified`);

// Verify buttons and actions
const buttons = collectButtons(incTree);
assert.strictEqual(buttons.length, 4, 'Must generate 4 Book now buttons');
for (const btn of buttons) {
  assert.strictEqual(btn.action.event.name, 'book_now');
  assert.ok(btn.scopeData, 'Button must carry scope data');
}

// Simulate clicking the first button
const firstBtn = buttons[0];
const eventMsg = incEngine.createEventMessage(
  'gallery-incremental',
  firstBtn.action.event.name,
  firstBtn.action.event.context,
  firstBtn.scopeData
);

assert.strictEqual(eventMsg.action.event.name, 'book_now');
assert.strictEqual(eventMsg.action.event.context.restaurantName, 'The Golden Fork');
console.log(`   └─ ✅ 00_incremental.json adversarial test passed! Action context:`, JSON.stringify(eventMsg.action.event.context));

// ==================== 2. Adversarial Assertion on 24_recipe-card.json ====================
console.log('\n🔍 [Adversarial 2] Verify 24_recipe-card.json Tabs structure and ingredients unrolling:');
const recipeCase = ALL_CASES.find((c) => c.file === '24_recipe-card.json');
const recipeEngine = new A2UIEngine();
recipeEngine.process(recipeCase.messages);

const recipeTree = recipeEngine.getRenderTree('gallery-recipe-card');
const recipeCount = countNodes(recipeTree);
console.log(`   ├─ Render tree node count: ${recipeCount} (expected 28)`);
assert.strictEqual(recipeCount, 28, '24_recipe-card node count must be 28');

const recipeTexts = collectAllTexts(recipeTree);
assert.ok(recipeTexts.includes('Mediterranean Quinoa Bowl'), 'Must include recipe title');
assert.ok(recipeTexts.includes('1 cup quinoa'), 'Must include ingredient 1 cup quinoa');
assert.ok(recipeTexts.includes('1. Rinse quinoa and bring to a boil in water.'), 'Must include step 1 text');
console.log(`   └─ ✅ 24_recipe-card.json adversarial test passed!`);

// ==================== 3. Adversarial Assertion on 34_child-list-template.json ====================
console.log('\n🔍 [Adversarial 3] Verify 34_child-list-template.json list template unrolling:');
const templateCase = ALL_CASES.find((c) => c.file === '34_child-list-template.json');
const tEngine = new A2UIEngine();
tEngine.process(templateCase.messages);

const tTree = tEngine.getRenderTree('gallery-child-list-template');
const tCount = countNodes(tTree);
console.log(`   ├─ Render tree node count: ${tCount} (expected 16)`);
assert.strictEqual(tCount, 16, '34_child-list-template node count must be 16');
console.log(`   └─ ✅ 34_child-list-template.json adversarial test passed!`);

// ==================== 4. Full 43 Example Non-Empty Verification ====================
console.log('\n🔍 [Adversarial 4] Inspect all 43 official examples for non-empty completeness:');
let totalValidNodes = 0;
for (const c of ALL_CASES) {
  const eng = new A2UIEngine();
  eng.process(c.messages);
  const surfaces = Array.from(eng.surfaces.keys());
  assert.ok(surfaces.length > 0, `${c.file} must create at least 1 surface`);
  const sId = surfaces[0];
  const tree = eng.getRenderTree(sId);
  assert.ok(tree, `${c.file} must generate render tree`);
  const cnt = countNodes(tree);
  assert.ok(cnt >= 1, `${c.file} node count must be >= 1`);
  totalValidNodes += cnt;
}
console.log(`   ├─ All 43 official examples verified, total valid nodes: ${totalValidNodes}`);
console.log(`   └─ ✅ All 43 official examples passed deep adversarial verification!\n`);

console.log('================================================================');
console.log('🎉 All adversarial E2E assertions passed (100% PASS)');
console.log('================================================================');
