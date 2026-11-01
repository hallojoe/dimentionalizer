import assert from 'node:assert/strict';
import test from 'node:test';
import { parseConfig, validateConfig } from '../src/config/validate';
import { MAX_ELEVATION } from '../src/config/elevation';
import { groupViewBounds, layoutGroups } from '../src/scene/layout';
import { loadSaved, saveConfig } from '../src/config/storage';

const input = () => ({
  schemaVersion: 1,
  groups: [{ id: 'g', name: 'Group' }, { id: 'other', name: 'Other' }],
  objects: [
    { id: 'a', name: 'Above', group: 'g' },
    { id: 'b', name: 'Below', group: 'g' },
    { id: 'c', name: 'Unchanged', group: 'other' },
  ],
  connections: [{ id: 'a-b', from: 'a', to: 'b' }],
});

test('older configurations and legacy arrays default to zero elevation and visible grid', () => {
  for (const document of [input(), [{ name: 'Legacy', group: 'Old', text: '' }]]) {
    const { config } = validateConfig(document);
    assert.ok(config.groups.every(g => g.elevation === 0));
    assert.ok(config.objects.every(o => o.elevation === 0));
    assert.equal(config.view.showGrid, true);
    assert.ok(layoutGroups(config).groups.every(g => g.y === 0 && g.objects.every(o => o.y === 0)));
  }
});

test('positive and negative item offsets compose with group elevation and preserve horizontal placement', () => {
  const { config } = validateConfig(input());
  const baseline = layoutGroups(config);
  config.groups[0].elevation = 10;
  config.objects[0].elevation = 10;
  config.objects[1].elevation = -10;
  const moved = layoutGroups(config);
  assert.equal(moved.groups[0].y, 10);
  assert.deepEqual(moved.groups[0].objects.map(o => o.y), [20, 0]);
  assert.equal(moved.groups[1].objects[0].y, 0);
  const horizontal = (layout: typeof baseline) => layout.groups.flatMap(g => g.objects.map(o => [o.object.id, o.x, o.z]));
  assert.deepEqual(horizontal(moved), horizontal(baseline));
  config.groups[0].elevation = -10;
  assert.deepEqual(layoutGroups(config).groups[0].objects.map(o => o.y), [0, -20]);
});

test('resetting group elevation keeps individual offsets; resetting item elevation returns it to the group', () => {
  const { config } = validateConfig(input());
  config.groups[0].elevation = -10;
  config.objects[0].elevation = 2.5;
  assert.equal(layoutGroups(config).groups[0].objects[0].y, -7.5);
  config.groups[0].elevation = 0;
  assert.equal(layoutGroups(config).groups[0].objects[0].y, 2.5);
  config.objects[0].elevation = 0;
  assert.equal(layoutGroups(config).groups[0].objects[0].y, 0);
});

test('overview and group focus account for objects far above and below their platforms', () => {
  const { config } = validateConfig(input());
  config.objects[0].elevation = 100;
  config.objects[1].elevation = -100;
  const layout = layoutGroups(config);
  assert.ok(layout.size >= 203.4);
  assert.ok(Math.abs(layout.centerY - 1.7) < 1e-10);
  const bounds = groupViewBounds(layout.groups[0]);
  assert.ok(bounds.size >= 203.4);
  assert.equal(bounds.centerY, layout.centerY);
});

test('JSON round-trip retains fractional signed elevations and false grid visibility', () => {
  const { config } = validateConfig(input());
  config.groups[0].elevation = -10.5;
  config.objects[0].elevation = 3.25;
  config.view.showGrid = false;
  const roundTrip = parseConfig(JSON.stringify(config)).config;
  assert.deepEqual(roundTrip, config);
  assert.equal(layoutGroups(roundTrip).groups[0].objects[0].y, -7.25);
});

test('invalid elevations and non-boolean grid settings are rejected before applying', () => {
  for (const bad of ['10', null, true, NaN, Infinity, -Infinity, MAX_ELEVATION + 1, -MAX_ELEVATION - 1]) {
    const document = input();
    assert.throws(() => validateConfig({ ...document, groups: [{ ...document.groups[0], elevation: bad }] }), /groups\[0\].elevation/);
    assert.throws(() => validateConfig({ ...document, objects: [{ ...document.objects[0], elevation: bad }] }), /objects\[0\].elevation/);
  }
  for (const bad of ['false', 0, null]) {
    assert.throws(() => validateConfig({ ...input(), view: { showGrid: bad } }), /view.showGrid/);
  }
});

test('browser storage restores elevation and grid settings together', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
  } });
  try {
    const { config } = validateConfig(input());
    config.groups[0].elevation = 10;
    config.objects[1].elevation = -10;
    config.view.showGrid = false;
    assert.equal(saveConfig(config), true);
    assert.deepEqual(loadSaved().config, config);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
