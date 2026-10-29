const assert = require('node:assert');
const { A2UIEngine, a2uiCustomBehavior } = require('../index.js');

console.log('🧪 开始运行业务自定义扩展组件全链路测试 (tests/custom-components-expansion.test.js)');

// =========================================================================
// [1] 自定义组件注册、打标 isCustom 与动态属性解析
// =========================================================================
console.log('\n👉 [1/6] 验证自定义组件打标 isCustom 与动态属性求解');
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
          chartTitle: '2026年Q3销售额折线图',
          seriesData: [120, 200, 150, 80],
          lat: 39.9042,
          lng: 116.4074,
          cityName: '北京',
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
  assert.ok(tree, '渲染树应当成功生成');
  assert.strictEqual(tree.children.length, 2);

  const chartNode = tree.children[0];
  assert.strictEqual(chartNode.component, 'VegaChart');
  assert.strictEqual(chartNode.isCustom, true, '自定义组件必须被标记为 isCustom: true');
  assert.strictEqual(chartNode.title, '2026年Q3销售额折线图', '动态 @path 标题求解应当正确');
  assert.deepStrictEqual(chartNode.data, [120, 200, 150, 80], '动态 @path 数据数组求解应当正确');
  assert.strictEqual(chartNode.theme, 'dark', '静态属性应当完整保留');
  assert.ok(chartNode.props, 'node.props 字典应当存在');
  assert.strictEqual(chartNode.props.title, '2026年Q3销售额折线图');
  assert.deepStrictEqual(chartNode.props.data, [120, 200, 150, 80]);

  const mapNode = tree.children[1];
  assert.strictEqual(mapNode.component, 'MapMarker');
  assert.strictEqual(mapNode.isCustom, true);
  assert.strictEqual(mapNode.latitude, 39.9042);
  assert.strictEqual(mapNode.city, '北京');

  console.log('   ✓ 自定义组件打标与动态属性求解完全正确');
}

// =========================================================================
// [2] 容器型自定义组件 (带 children) 递归子树编译
// =========================================================================
console.log('\n👉 [2/6] 验证容器型自定义组件递归编译 children (子树倒灌基础)');
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
          userTip: '系统负载正常',
        },
        components: [
          {
            id: 'root',
            component: 'MyAccordion',
            title: '系统监控折叠板',
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
            text: '刷新数据',
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
  assert.strictEqual(tree.children.length, 3, '容器型自定义组件必须拥有完整的子节点 AST');

  // 第 1 个子节点是自定义组件 MyGauge
  const child1 = tree.children[0];
  assert.strictEqual(child1.component, 'MyGauge');
  assert.strictEqual(child1.isCustom, true);
  assert.strictEqual(child1.percent, 85);

  // 第 2 个子节点是标准 Text
  const child2 = tree.children[1];
  assert.strictEqual(child2.component, 'Text');
  assert.strictEqual(child2.text, '系统负载正常');

  // 第 3 个子节点是标准 Button
  const child3 = tree.children[2];
  assert.strictEqual(child3.component, 'Button');
  assert.strictEqual(child3.text, '刷新数据');

  console.log('   ✓ 容器型自定义组件混合包含自定义与官方组件编译正确');
}

// =========================================================================
// [3] 自定义组件的双向数据绑定反写与定向差量补丁
// =========================================================================
console.log('\n👉 [3/6] 验证自定义组件双向数据绑定与差量 patches 计算');
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

  // 模拟客户端输入反写
  engine.handleInputChange('surf_input', '/selectedColor', '#00ff00', { silent: true });
  const tree2 = engine.getRenderTree('surf_input');
  assert.strictEqual(tree2.children[0].value, '#00ff00');

  // 计算差量补丁
  const patches = engine.computeTreePatches(tree1, tree2, 'localRenderTree');
  assert.ok(Object.keys(patches).length > 0);
  assert.ok(
    patches['localRenderTree.children[0].value'] === '#00ff00' ||
    patches['localRenderTree.children[0]'] !== undefined,
    '应当生成针对自定义组件的值补丁'
  );

  console.log('   ✓ 自定义组件双向绑定与差量补丁验证通过');
}

// =========================================================================
// [4] Action 动作消息闭环生成
// =========================================================================
console.log('\n👉 [4/6] 验证自定义组件 Action 出站协议生成');
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

  console.log('   ✓ 自定义组件 Action 出站报文封装符合 A2UI v1.0 规范');
}

// =========================================================================
// [5] a2uiCustomBehavior 模块定义验证
// =========================================================================
console.log('\n👉 [5/6] 验证 a2uiCustomBehavior 模块导出');
{
  assert.ok(a2uiCustomBehavior !== undefined, 'a2uiCustomBehavior 必须正常导出');
  console.log('   ✓ a2uiCustomBehavior 模块导出正常');
}

// =========================================================================
// [6] 未注册未知组件的防御隔离
// =========================================================================
console.log('\n👉 [6/6] 验证未注册的幻觉组件触发 UNKNOWN_COMPONENT 但不崩溃');
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
            text: '我是未注册组件',
          },
        ],
      },
    },
  ]);

  assert.strictEqual(errorCount, 1, '未注册未知组件必须触发 UNKNOWN_COMPONENT 错误上报');
  const tree = engine.getRenderTree('surf_unknown');
  assert.ok(tree, '引擎树构建绝不崩溃');
  assert.strictEqual(tree.isCustom, true, '即使未注册也打标 isCustom 以便 WXML 兜底渲染');

  console.log('   ✓ 未知组件错误上报与安全构建验证通过');
}

console.log('\n🎉 所有业务自定义扩展组件全链路测试 100% 通过！\n');
