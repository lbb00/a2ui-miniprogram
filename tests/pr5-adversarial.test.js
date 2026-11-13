const assert = require('node:assert/strict');
const { A2UIEngine } = require('../miniprogram');

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test('createSurface honors @catalogId, including standard-over-legacy precedence', () => {
  const engine = new A2UIEngine();
  engine.process({ createSurface: { surfaceId: 's', '@catalogId': 'standard' } });
  assert.equal(engine.surfaces.get('s').catalogId, 'standard');
  engine.process({ createSurface: { surfaceId: 's', catalogId: 'legacy', '@catalogId': 'updated' } });
  assert.equal(engine.surfaces.get('s').catalogId, 'updated');
  let outbound;
  engine.setOutboundListener(msg => { outbound = msg; });
  const pending = engine.callAgentFunction('s', { '@call': 'query' });
  assert.equal(outbound.callAgentFunction.callFunction.catalogId, 'updated');
  engine.handleAgentFunctionResponse({ functionCallId: outbound.callAgentFunction.functionCallId, value: true });
  return pending.then(value => assert.equal(value, true));
});

test('renderer RPC assimilates thenables instead of emitting a spurious error', async () => {
  const engine = new A2UIEngine();
  const outbound = [];
  engine.addOutboundListener(msg => outbound.push(msg));
  // oxlint-disable-next-line unicorn/no-thenable -- Deliberately test PromiseLike interoperability.
  engine.registerRendererFunction('thenable', () => ({ then(resolve) { resolve(42); } }));
  const response = await engine.process({ callRendererFunction: {
    functionCallId: 'thenable-success', callFunction: { '@call': 'thenable' }
  } });
  assert.equal(outbound.length, 1);
  assert.equal(response.rendererFunctionResponse.value, 42);
  // oxlint-disable-next-line unicorn/no-thenable -- Deliberately test rejecting PromiseLike values.
  engine.registerRendererFunction('thenableFail', () => ({ then(_resolve, reject) { reject(new Error('rejected')); } }));
  const error = await engine.callRendererFunction({ functionCallId: 'thenable-fail', callFunction: { '@call': 'thenableFail' } });
  assert.equal(outbound.length, 2);
  assert.equal(error.rendererFunctionResponse.error.message, 'rejected');
  engine.destroy();
});

test('large envelope arrays do not exceed the JavaScript argument limit', () => {
  const engine = new A2UIEngine();
  const message = { createSurface: { surfaceId: 'large' } };
  assert.doesNotThrow(() => engine.process({ agent_to_renderer: Array(150000).fill(message) }));
  assert.ok(engine.surfaces.has('large'));
  engine.destroy();
});

test('deep and cyclic array envelopes fail closed without recursive overflow', () => {
  const engine = new A2UIEngine();
  const errors = [];
  engine.onError(msg => errors.push(msg.error));
  let nested = { createSurface: { surfaceId: 'too-deep' } };
  for (let i = 0; i < 10000; i++) nested = { agent_to_renderer: [nested] };
  assert.doesNotThrow(() => engine.process(nested));
  assert.equal(engine.surfaces.has('too-deep'), false);
  const cyclic = { agent_to_renderer: [] };
  cyclic.agent_to_renderer.push(cyclic);
  assert.doesNotThrow(() => engine.processMessage(cyclic));
  assert.equal(errors.length, 2);
  assert.ok(errors.every(error => error.code === 'VALIDATION_FAILED'));
  engine.destroy();
});

test('late renderer success and failure cannot escape deleted or cleared sessions', async () => {
  for (const lifecycle of ['clear', 'delete', 'destroy']) {
    for (const fail of [false, true]) {
      const engine = new A2UIEngine();
      engine.process({ createSurface: { surfaceId: 's' } });
      const outbound = [];
      engine.addOutboundListener(msg => outbound.push(msg));
      let complete;
      engine.registerRendererFunction('slow', () => new Promise((resolve, reject) => {
        complete = () => fail ? reject(new Error('old failure')) : resolve('old data');
      }));
      const pending = engine.process({ callRendererFunction: {
        surfaceId: 's', functionCallId: 'late', callFunction: { '@call': 'slow' }
      } });
      if (lifecycle === 'delete') engine.process({ deleteSurface: { surfaceId: 's' } });
      else engine[lifecycle]();
      // Reattach a listener after destroy to ensure the completion itself is suppressed.
      if (lifecycle === 'destroy') engine.addOutboundListener(msg => outbound.push(msg));
      else engine.process({ createSurface: { surfaceId: 's' } });
      complete();
      assert.equal(await pending, null, `${lifecycle}: stale result must be discarded`);
      assert.equal(outbound.length, 0, `${lifecycle}: no cross-session response`);
      engine.destroy();
    }
  }
});

test('clear resets renderer replay state for a new session', () => {
  const engine = new A2UIEngine();
  let calls = 0;
  engine.registerRendererFunction('count', () => ++calls);
  const message = { callRendererFunction: { functionCallId: 'session-request-1', callFunction: { '@call': 'count' } } };
  engine.process(message);
  engine.process(message);
  assert.equal(calls, 1, 'same-session replay must still be suppressed');
  engine.clear();
  engine.process(message);
  assert.equal(calls, 2, 'new-session request must execute');
  engine.destroy();
});

test('mixed nested envelopes preserve sync compatibility and one notification per surface', async () => {
  const engine = new A2UIEngine();
  const notified = [];
  engine.subscribe(surfaceId => notified.push(surfaceId));
  engine.registerRendererFunction('sync', () => 1);
  engine.registerRendererFunction('async', async () => 2);
  const sync = engine.process({ callRendererFunction: { functionCallId: 'sync', callFunction: { '@call': 'sync' } } });
  assert.equal(sync.rendererFunctionResponse.value, 1);
  assert.equal(sync instanceof Promise, false);
  const mixed = await engine.process({ agent_to_renderer: [
    { createSurface: { surfaceId: 'mixed' } },
    { agent_to_renderer: [
      { updateDataModel: { surfaceId: 'mixed', path: '/v', value: 1 } },
      { callRendererFunction: { functionCallId: 'a', callFunction: { '@call': 'async' } } },
      { callRendererFunction: { functionCallId: 'b', callFunction: { '@call': 'sync' } } }
    ] }
  ] });
  assert.deepEqual(mixed.map(msg => msg.rendererFunctionResponse.value), [2, 1]);
  assert.deepEqual(notified, ['mixed']);
  engine.destroy();
});

test('deleting another surface does not discard a valid in-flight RPC', async () => {
  const engine = new A2UIEngine();
  engine.process([{ createSurface: { surfaceId: 'a' } }, { createSurface: { surfaceId: 'b' } }]);
  let complete;
  engine.registerRendererFunction('slow', () => new Promise(resolve => { complete = resolve; }));
  const pending = engine.process({ callRendererFunction: {
    surfaceId: 'a', functionCallId: 'valid', callFunction: { '@call': 'slow' }
  } });
  engine.process({ deleteSurface: { surfaceId: 'b' } });
  complete(3);
  assert.equal((await pending).rendererFunctionResponse.value, 3);
  engine.destroy();
});

test('root and MiniProgram declaration entrypoints remain identical', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  assert.equal(fs.readFileSync(path.join(__dirname, '../index.d.ts'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../miniprogram/index.d.ts'), 'utf8'));
});

// This locks existing metadata-only behavior, NOT an authorization/security guarantee.
// Applications must authorize untrusted requests before dispatching them to the engine.
test('catalog registration stores metadata only and does not introduce RPC denial semantics', async () => {
  const engine = new A2UIEngine();
  try {
    engine.registerCatalog('metadata-only', { components: [], functions: [], allowedCallers: ['renderer'] });
    const metadata = engine.catalogs.get('metadata-only');
    assert.deepEqual([...metadata.components], []);
    assert.deepEqual([...metadata.functions], []);
    assert.deepEqual(metadata.allowedCallers, ['renderer']);
    engine.process({ createSurface: { surfaceId: 'catalog', catalogId: 'metadata-only',
      components: [{ id: 'root', component: 'Text', text: 'local fixture' }] } });
    assert.equal(engine.getRenderTree('catalog').text, 'local fixture');
    let count = 0;
    engine.registerRendererFunction('localProbe', () => ++count);
    const result = engine.process({ callRendererFunction: {
      surfaceId: 'catalog', functionCallId: 'metadata-agent',
      callFunction: { '@call': 'localProbe', '@catalogId': 'metadata-only' }
    } });
    assert.equal(count, 1, 'metadata is not a renderer-function access-control list');
    assert.equal(result.rendererFunctionResponse.value, 1);

    engine.registerCatalog('metadata-only', { functions: [], allowedCallers: ['agent'] });
    engine.setOutboundListener(message => {
      const call = message.callAgentFunction;
      assert.equal(call.callFunction.catalogId, 'metadata-only');
      engine.handleAgentFunctionResponse({ functionCallId: call.functionCallId, value: 'local reply' });
    });
    assert.equal(await engine.callAgentFunction('catalog', { '@call': 'localAgentProbe' }), 'local reply');
  } finally {
    engine.destroy();
  }
});

test('public catalog documentation discloses that authorization is not enforced', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['README.md', 'CHANGELOG.md', 'index.d.ts', 'miniprogram/index.d.ts', 'miniprogram/core/engine.js']) {
    const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.ok(text.includes('does not enforce authorization'), `${file}: disclose the metadata-only security boundary`);
  }
  const chinese = fs.readFileSync(path.join(__dirname, '../README.zh-CN.md'), 'utf8');
  assert.ok(chinese.includes('不执行授权'), 'Chinese README must disclose the same limitation');
});

async function run() {
  let failed = 0;
  for (const { name, run } of tests) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (error) { failed++; console.error(`FAIL ${name}`, error); }
  }
  console.log(`${tests.length - failed}/${tests.length} adversarial checks passed`);
  if (failed) process.exitCode = 1;
}
run();
