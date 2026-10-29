const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');

console.log('================================================================');
console.log('🧪 开始执行 a2ui-surface 组件级输入防跳动与定向刷新集成测试');
console.log('================================================================');

{
  let componentDefinition = null;
  global.Component = (def) => {
    componentDefinition = def;
  };

  // 载入组件定义
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  assert.ok(componentDefinition, '成功拦截并解析 a2ui-surface 组件原型');

  const engine = new A2UIEngine();
  const surfaceId = 'surf_form';
  engine.process([
    {
      createSurface: {
        surfaceId,
        dataModel: {
          username: '',
          password: '',
        },
        components: [
          { id: 'root', component: 'Column', children: ['u_in', 'p_in', 'btn'] },
          { id: 'u_in', component: 'TextField', value: { '@path': '/username' } },
          { id: 'p_in', component: 'TextField', value: { '@path': '/password' } },
          {
            id: 'btn',
            component: 'Button',
            text: 'Submit',
            checks: [
              {
                condition: {
                  '@call': 'regex',
                  args: { pattern: '^[a-zA-Z0-9]{3,}$', value: { '@path': '/username' } },
                },
                message: 'Username too short',
              },
            ],
          },
        ],
      },
    },
  ]);

  const initialTree = engine.getRenderTree(surfaceId);
  assert.strictEqual(initialTree.children[2].disabled, true, '初始 checks 未通过时按钮 disabled 为 true');

  let setDataCalls = [];
  let triggeredEvents = [];

  const mockInstance = {
    data: {
      surfaceId,
      localRenderTree: JSON.parse(JSON.stringify(initialTree)),
    },
    engine,
    setData(data, cb) {
      setDataCalls.push(data);
      if (typeof cb === 'function') cb();
    },
    triggerEvent(name, detail) {
      triggeredEvents.push({ name, detail });
    },
  };

  // 模拟用户在 u_in 输入 "adm"
  componentDefinition.methods.dispatchInputEvent.call(
    mockInstance,
    'u_in',
    '/username',
    'adm'
  );

  // 断言：
  // 1. 数据模型已反写为 "adm"
  assert.strictEqual(engine.surfaces.get(surfaceId).dataModel.username, 'adm');

  // 2. setData 必须通过差量路径更新，且不能包含 u_in 的 value (防真机光标跳动)
  assert.ok(setDataCalls.length >= 1, '必须触发定向 setData 差量刷新');
  const latestSetData = setDataCalls[0];
  console.log('   ├─ 组件触发的定向差量 setData 参数:', latestSetData);

  // 校验 active input 的 value 绝不回写
  assert.strictEqual(latestSetData['localRenderTree.children[0].value'], undefined, 'activeComponentId 的 value 绝不传入 setData');

  // 校验按钮的 disabled 从 true 变为 false (定向刷新)
  assert.strictEqual(latestSetData['localRenderTree.children[2].disabled'], false, '按钮解除 disabled 成功定向刷新');

  // 3. inputChange 事件正常派发
  const inputEvent = triggeredEvents.find((e) => e.name === 'inputChange');
  assert.ok(inputEvent, '必须派发 inputChange 事件');
  assert.strictEqual(inputEvent.detail.value, 'adm');

  delete global.Component;
  console.log('   ✓ a2ui-surface 定向差量刷新与受控输入防跳动集成断言 100% 通过！\n');
}
