const assert = require('assert');
const { A2UIEngine } = require('../miniprogram/core/engine');

console.log('================================================================');
console.log('🧪 Running a2ui-surface component-level cursor jumping & patch tests');
console.log('================================================================');

{
  let componentDefinition = null;
  global.Component = (def) => {
    componentDefinition = def;
  };

  // Load component definition
  delete require.cache[require.resolve('../miniprogram/components/a2ui-surface/a2ui-surface.js')];
  require('../miniprogram/components/a2ui-surface/a2ui-surface.js');

  assert.ok(componentDefinition, 'Intercepted and parsed a2ui-surface component prototype');

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
  assert.strictEqual(initialTree.children[2].disabled, true, 'Initial checks failing must disable button');

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

  // Simulate user typing "adm" in u_in
  componentDefinition.methods.dispatchInputEvent.call(
    mockInstance,
    'u_in',
    '/username',
    'adm'
  );

  // Assertions:
  // 1. Data model updated to "adm"
  assert.strictEqual(engine.surfaces.get(surfaceId).dataModel.username, 'adm');

  // 2. setData must use incremental patch and exclude u_in value to prevent cursor jump
  assert.ok(setDataCalls.length >= 1, 'Directional setData patch must be triggered');
  const latestSetData = setDataCalls[0];
  console.log('   ├─ Component directional setData payload:', latestSetData);

  // Verify active input value is never written back
  assert.strictEqual(latestSetData['localRenderTree.children[0].value'], undefined, 'activeComponentId value must not be sent in setData');

  // Verify button disabled flips from true to false
  assert.strictEqual(latestSetData['localRenderTree.children[2].disabled'], false, 'Button disabled flipped to false via directional patch');

  // 3. inputChange event emitted properly
  const inputEvent = triggeredEvents.find((e) => e.name === 'inputChange');
  assert.ok(inputEvent, 'inputChange event must be emitted');
  assert.strictEqual(inputEvent.detail.value, 'adm');

  delete global.Component;
  console.log('   ✓ a2ui-surface directional diffing and cursor stability verified (100%)\n');
}
