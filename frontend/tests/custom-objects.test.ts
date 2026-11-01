import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getObjectCatalog, objectCatalog, resolveType } from '../src/catalog/catalog';
import { validateConfig, parseConfig } from '../src/config/validate';
import { resolveModelUrl } from '../src/config/model-url';
import { loadSaved, saveConfig } from '../src/config/storage';

const input = () => ({ schemaVersion: 1,
  objectTypes: [{ id: 'customer', name: 'Customer', shape: 'user' }],
  groups: [{ id: 'people', name: 'People' }],
  objects: [{ id: 'one', name: 'One', group: 'people', type: 'customer' }],
});

test('business and flow meanings are built in and schema shape completion matches the registry', () => {
  for (const id of ['user', 'usergroup', 'event', 'product', 'shop', 'warehouse', 'workflow', 'request', 'response', 'processing', 'api-call', 'webhook', 'dataflow', 'message']) {
    assert.equal(resolveType(id).id, id);
  }
  const schema = JSON.parse(readFileSync(new URL('../public/architecture.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(schema.properties.objectTypes.items.properties.shape.enum, objectCatalog.map(t => t.id));
});

test('custom type meaning survives resolution independently of the reused shape', () => {
  const { config, warnings } = validateConfig(input());
  assert.deepEqual(warnings, []);
  const type = resolveType('customer', config.objectTypes);
  assert.equal(type.name, 'Customer');
  assert.equal(type.shape, 'user');
  assert.equal(type.custom, true);
  assert.equal(getObjectCatalog(config.objectTypes).length, objectCatalog.length + 1);
  assert.equal(resolveType('customer').id, 'container');
  assert.equal(resolveType(undefined, config.objectTypes).id, 'container');
  assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
});

test('unknown types retain the original fallback and older documents need no custom catalog', () => {
  const document = input(); document.objects[0].type = 'future-object';
  const { config, warnings } = validateConfig(document);
  assert.equal(config.objects[0].type, 'future-object');
  assert.equal(warnings.length, 1);
  const legacy = validateConfig([{ name: 'A', group: 'B' }]).config;
  assert.deepEqual(legacy.objectTypes, []);
});

test('custom IDs cannot shadow built-ins, duplicate, or alias another custom shape', () => {
  for (const types of [[{ id: 'user', name: 'Replace user' }], [input().objectTypes[0], input().objectTypes[0]],
    [{ id: 'bad id', name: 'Bad' }], [{ id: 'a', name: 'A', shape: 'b' }, { id: 'b', name: 'B' }],
    [{ id: 'a', name: 'A', symbol: 'too many characters' }], null]) {
    assert.throws(() => validateConfig({ ...input(), objectTypes: types }), /objectTypes/);
  }
});

test('model URLs and rotation are validated before use and resolve under a subdirectory deployment', () => {
  for (const url of ['models/item.glb', 'models/item.gltf', 'https://example.com/item.glb']) {
    const { config } = validateConfig({ ...input(), objectTypes: [{ ...input().objectTypes[0], model: { url } }] });
    assert.deepEqual(config.objectTypes[0].model?.rotation, [0, 0, 0]);
  }
  assert.equal(resolveModelUrl('models/item.glb', 'https://example.com/explorer/'), 'https://example.com/explorer/models/item.glb');
  for (const url of ['javascript:alert(1)', 'file:///item.glb', 'blob:session', '../item.glb', '/item.glb', '//example.com/item.glb',
    'http://example.com/item.glb', 'https://u:p@example.com/item.glb', 'models/item.js', 'models/%2e%2e/item.glb', 'models\\item.glb']) {
    assert.throws(() => validateConfig({ ...input(), objectTypes: [{ id: 'a', name: 'A', model: { url } }] }), /objectTypes\[0\].model.url/);
  }
  for (const rotation of [[1, 2], [1, 2, 3, 4], [0, '1', 0], [0, 361, 0], [0, null, 0]]) {
    assert.throws(() => validateConfig({ ...input(), objectTypes: [{ id: 'a', name: 'A', model: { url: 'models/a.glb', rotation } }] }), /rotation/);
  }
});

test('custom definitions and model references survive browser storage and export together', () => {
  const { config } = parseConfig(readFileSync(new URL('../public/examples/custom-objects.json', import.meta.url), 'utf8'));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
  } });
  try {
    assert.equal(saveConfig(config), true);
    assert.deepEqual(loadSaved().config, config);
    assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
    assert.equal(config.objectTypes[0].model?.url, 'models/parcel-locker.gltf');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
