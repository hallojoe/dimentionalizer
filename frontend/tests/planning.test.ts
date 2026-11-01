import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseConfig, validateConfig } from '../src/config/validate';
import { duplicateSpace } from '../src/config/spaces';
import { layoutGroups } from '../src/scene/layout';
import { loadSaved, saveConfig } from '../src/config/storage';

const preset = (id: string) => parseConfig(readFileSync(new URL(`../public/presets/${id}.json`, import.meta.url), 'utf8')).config;

test('complex workflows contain named branches, varied elevation, spacing, and useful unchecked actions', () => {
  for (const id of ['whole-day', 'application-review', 'request-instances', 'household-week']) {
    const config = preset(id);
    assert.ok(config.objects.length >= 16);
    assert.ok(config.planes.some(p => p.elevation > 0) && config.planes.some(p => p.elevation < 0));
    assert.ok(config.groups.some(g => g.spacing?.target === 'children'));
    assert.ok(config.connections.some(c => c.style === 'wobbly'));
    const checks = config.objects.flatMap(o => o.checklist ?? []);
    assert.ok(checks.length >= 8); assert.ok(checks.every(c => !c.done && c.text.length > 10));
    assert.deepEqual(layoutGroups(config).warnings, []);
    assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
  }
});

test('duplicated checklists and spacing are independent of the source document', () => {
  const original = preset('household-week'), before = structuredClone(original);
  const copy = duplicateSpace(original, 'main', 'Another week').config;
  const originalIds = new Set(original.objects.map(o => o.id));
  const task = copy.objects.find(o => !originalIds.has(o.id) && o.checklist?.length)!;
  task.checklist![0].done = true;
  copy.spaces.at(-1)!.spacing!.value = 10;
  assert.deepEqual(original, before);
  assert.ok(copy.objects.filter(o => originalIds.has(o.id)).flatMap(o => o.checklist ?? []).every(c => !c.done));
});

test('checked state is retained with spacing through local saving and JSON export', () => {
  const config = preset('whole-day'); config.objects.find(o => o.checklist?.length)!.checklist![0].done = true;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } } });
  try { assert.equal(saveConfig(config), true); assert.deepEqual(loadSaved().config, config); assert.deepEqual(parseConfig(JSON.stringify(config)).config, config); }
  finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

test('checklist validation catches malformed items, duplicate IDs, invalid states, and excessive item counts', () => {
  for (const checklist of [null, [{ id: 'a', text: 'One', done: 'yes' }], [{ id: 'a', text: '' }], [{ id: 'a', text: 'One' }, { id: 'a', text: 'Two' }], Array.from({ length: 21 }, (_, i) => ({ id: String(i), text: 'Task' }))]) {
    const config = preset('household-week'); Object.assign(config.objects[0], { checklist });
    assert.throws(() => validateConfig(config), /checklist/);
  }
});
