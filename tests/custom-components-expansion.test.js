const assert = require('node:assert');
const { A2UIEngine, a2uiCustomBehavior } = require('../index.js');

console.log('🧪 Running custom components expansion lifecycle tests (tests/custom-components-expansion.test.js)');

// =========================================================================
// [1] Custom component registration, isCustom tagging & dynamic properties
// =========================================================================
console.log('\n👉 [1/6] Verify custom component registration, isCustom tag & dynamic property resolution');
{
  const engine = new A2UIEngine();
  engine.registerCustomComponent('VegaChart');
  engine.registerCustomComponent('MapMarker');

  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_custom',
        dataModel: {
          chartTitle: 'Q3 2026 Sales Trend',
          seriesData: [120, 200, 150, 80],
          lat: 39.9042,
          lng: 116.4074,
          cityName: 'Beijing',
        },
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['chart_1', 'map_1'],
          },
          {
            id: 'chart_1',
            component: 'VegaChart',
            title: { '@path': '/chartTitle' },
            data: { '@path': '/seriesData' },
            theme: 'dark',
            action: {
              event: {
                name: 'chart_point_click',
                context: { title: { '@path': '/chartTitle' } },
              },
            },
          },
          {
            id: 'map_1',
            component: 'MapMarker',
            latitude: { '@path': '/lat' },
            longitude: { '@path': '/lng' },
            city: { '@path': '/cityName' },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree('surf_custom');
  assert.ok(tree, 'Render tree should be generated successfully');
  assert.strictEqual(tree.children.length, 2);

  const chartNode = tree.children[0];
  assert.strictEqual(chartNode.component, 'VegaChart');
  assert.strictEqual(chartNode.isCustom, true, 'Custom component must have isCustom: true');
  assert.strictEqual(chartNode.title, 'Q3 2026 Sales Trend', 'Dynamic @path title should resolve correctly');
  assert.deepStrictEqual(chartNode.data, [120, 200, 150, 80], 'Dynamic @path series data should resolve correctly');
  assert.strictEqual(chartNode.theme, 'dark', 'Static properties must be preserved');
  assert.ok(chartNode.props, 'node.props map must exist');
  assert.strictEqual(chartNode.props.title, 'Q3 2026 Sales Trend');
  assert.deepStrictEqual(chartNode.props.data, [120, 200, 150, 80]);

  const mapNode = tree.children[1];
  assert.strictEqual(mapNode.component, 'MapMarker');
  assert.strictEqual(mapNode.isCustom, true);
  assert.strictEqual(mapNode.latitude, 39.9042);
  assert.strictEqual(mapNode.city, 'Beijing');

  console.log('   ✓ Custom component tagging & dynamic property resolution verified');
}

// =========================================================================
// [2] Container-type custom component with children recursive AST compilation
// =========================================================================
console.log('\n👉 [2/6] Verify container custom component recursive children compilation');
{
  const engine = new A2UIEngine();
  engine.registerCustomComponent('MyAccordion');
  engine.registerCustomComponent('MyGauge');

  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_container',
        dataModel: {
          gaugeVal: 85,
          userTip: 'System load normal',
        },
        components: [
          {
            id: 'root',
            component: 'MyAccordion',
            title: 'Monitoring Accordion',
            children: ['gauge_1', 'tip_text', 'action_btn'],
          },
          {
            id: 'gauge_1',
            component: 'MyGauge',
            percent: { '@path': '/gaugeVal' },
          },
          {
            id: 'tip_text',
            component: 'Text',
            text: { '@path': '/userTip' },
          },
          {
            id: 'action_btn',
            component: 'Button',
            text: 'Refresh Data',
            action: {
              event: { name: 'refresh_metrics' },
            },
          },
        ],
      },
    },
  ]);

  const tree = engine.getRenderTree('surf_container');
  assert.ok(tree);
  assert.strictEqual(tree.component, 'MyAccordion');
  assert.strictEqual(tree.isCustom, true);
  assert.strictEqual(tree.children.length, 3, 'Container custom component must preserve children AST');

  // First child is custom component MyGauge
  const child1 = tree.children[0];
  assert.strictEqual(child1.component, 'MyGauge');
  assert.strictEqual(child1.isCustom, true);
  assert.strictEqual(child1.percent, 85);

  // Second child is standard Text
  const child2 = tree.children[1];
  assert.strictEqual(child2.component, 'Text');
  assert.strictEqual(child2.text, 'System load normal');

  // Third child is standard Button
  const child3 = tree.children[2];
  assert.strictEqual(child3.component, 'Button');
  assert.strictEqual(child3.text, 'Refresh Data');

  console.log('   ✓ Container custom component mixing custom and standard components verified');
}

// =========================================================================
// [3] Custom component two-way data binding and delta patches
// =========================================================================
console.log('\n👉 [3/6] Verify custom component two-way binding & delta patch calculation');
{
  const engine = new A2UIEngine();
  engine.registerCustomComponent('ColorPicker');

  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_input',
        dataModel: {
          selectedColor: '#ff0000',
        },
        components: [
          {
            id: 'root',
            component: 'Card',
            children: ['picker_1'],
          },
          {
            id: 'picker_1',
            component: 'ColorPicker',
            value: { '@path': '/selectedColor' },
          },
        ],
      },
    },
  ]);

  const tree1 = engine.getRenderTree('surf_input');
  assert.strictEqual(tree1.children[0].value, '#ff0000');
  assert.strictEqual(tree1.children[0].valuePath, '/selectedColor');

  // Simulate client input write-back
  engine.handleInputChange('surf_input', '/selectedColor', '#00ff00', { silent: true });
  const tree2 = engine.getRenderTree('surf_input');
  assert.strictEqual(tree2.children[0].value, '#00ff00');

  // Compute delta patches
  const patches = engine.computeTreePatches(tree1, tree2, 'localRenderTree');
  assert.ok(Object.keys(patches).length > 0);
  assert.ok(
    patches['localRenderTree.children[0].value'] === '#00ff00' ||
    patches['localRenderTree.children[0]'] !== undefined,
    'Should produce value patch targeting custom component'
  );

  console.log('   ✓ Custom component two-way binding & delta patch verified');
}

// =========================================================================
// [4] Action outbound message generation
// =========================================================================
console.log('\n👉 [4/6] Verify custom component action outbound message generation');
{
  const engine = new A2UIEngine();
  engine.registerCustomComponent('QuickCard');

  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_action',
        dataModel: {
          userId: 'user_999',
        },
        components: [
          {
            id: 'root',
            component: 'QuickCard',
            action: {
              event: {
                name: 'card_tap',
                context: { uid: { '@path': '/userId' } },
              },
            },
          },
        ],
      },
    },
  ]);

  const actionMsg = engine.createActionMessage('surf_action', 'root');
  assert.ok(actionMsg);
  assert.strictEqual(actionMsg.version, 'v1.0');
  assert.strictEqual(actionMsg.action.name, 'card_tap');
  assert.strictEqual(actionMsg.action.sourceComponentId, 'root');
  assert.deepStrictEqual(actionMsg.action.context, { uid: 'user_999' });

  console.log('   ✓ Custom component action outbound message aligns with A2UI v1.0 spec');
}

// =========================================================================
// [5] a2uiCustomBehavior module export verification
// =========================================================================
console.log('\n👉 [5/6] Verify a2uiCustomBehavior module export');
{
  assert.ok(a2uiCustomBehavior !== undefined, 'a2uiCustomBehavior must be exported');
  console.log('   ✓ a2uiCustomBehavior exported successfully');
}

// =========================================================================
// [6] Unregistered component defense & isolation
// =========================================================================
console.log('\n👉 [6/6] Verify unregistered component triggers UNKNOWN_COMPONENT error without crashing');
{
  const engine = new A2UIEngine();
  let errorCount = 0;
  engine.addErrorListener((e) => {
    if (e.error && e.error.code === 'UNKNOWN_COMPONENT') {
      errorCount++;
    }
  });

  engine.process([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'surf_unknown',
        components: [
          {
            id: 'root',
            component: 'HallucinatedWidget',
            text: 'Unregistered widget node',
          },
        ],
      },
    },
  ]);

  assert.strictEqual(errorCount, 1, 'Unregistered component must trigger UNKNOWN_COMPONENT error event');
  const tree = engine.getRenderTree('surf_unknown');
  assert.ok(tree, 'Engine tree generation must not crash');
  assert.strictEqual(tree.isCustom, true, 'Tagged with isCustom for WXML generic fallback');

  console.log('   ✓ Unregistered component error interception & safe rendering verified');
}

console.log('\n🎉 All custom components expansion tests passed 100%!\n');
