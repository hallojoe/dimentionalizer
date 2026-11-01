import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseConfig, validateConfig } from '../src/config/validate';
import { endpointKey } from '../src/config/connections';
import { sceneVisibility, visibleEntities, visibilityNote } from '../src/config/visibility';
import { layoutGroups } from '../src/scene/layout';
import { duplicateSpace } from '../src/config/spaces';
import { loadSaved, saveConfig } from '../src/config/storage';
import type { ArchitectureConfig, EntityRef } from '../src/config/types';

const key = (kind: EntityRef['kind'], id: string) => endpointKey({ kind, id });
function fixture() {
  return validateConfig({ schemaVersion: 1,
    spaces: [{ id: 'outside', name: 'Outside' }, { id: 'inside', name: 'Inside' }],
    planes: [{ id: 'p', name: 'Plane', space: 'outside' }, { id: 'q', name: 'Other plane', space: 'inside' }],
    groups: [{ id: 'g', name: 'Group', plane: 'p' }, { id: 'h', name: 'Other group', plane: 'q' }, { id: 'empty', name: 'Empty', plane: 'p' }],
    objects: [{ id: 'a', name: 'A', group: 'g', linkedSpace: 'inside' }, { id: 'b', name: 'B', group: 'g' }, { id: 'c', name: 'C', group: 'h' }],
    connections: [
      { id: 'ab', from: 'a', to: 'b', direction: 'bidirectional' },
      { id: 'gc', from: { kind: 'group', id: 'g' }, to: 'c' },
      { id: 'pq', from: { kind: 'plane', id: 'p' }, to: { kind: 'plane', id: 'q' } },
    ],
  }).config;
}
const state = (config: ArchitectureConfig) => sceneVisibility(config, new Set(config.objects.map(o => o.id)));
const links = (config: ArchitectureConfig) => {
  const { endpoints } = state(config);
  return config.connections.filter(c => endpoints.has(endpointKey(c.from)) && endpoints.has(endpointKey(c.to))).map(c => c.id);
};

test('existing documents and legacy imports show all entities and frames by default', () => {
  for (const config of [fixture(), validateConfig([{ name: 'Old', group: 'Group' }]).config]) {
    assert.equal(config.view.showPlaneFrames, true);
    assert.equal(config.view.showGroupFrames, true);
    assert.ok([...config.planes, ...config.groups, ...config.objects].every(e => e.visible));
    assert.ok([...config.planes, ...config.groups].every(e => e.showFrame));
    assert.equal(state(config).objects.size, config.objects.length);
    assert.equal(state(config).frames.size, config.spaces.length + config.planes.length + config.groups.length);
  }
});

test('global frame toggles remove frame geometry and heading gates without hiding contents or connectors', () => {
  const config = fixture(), baseline = state(config);
  config.view.showPlaneFrames = false;
  let result = state(config);
  assert.ok(!result.frames.has(key('plane', 'p')));
  assert.ok(result.frames.has(key('group', 'g')));
  config.view.showGroupFrames = false;
  result = state(config);
  assert.ok(!result.frames.has(key('group', 'g')));
  assert.deepEqual(result.objects, baseline.objects);
  assert.deepEqual(result.endpoints, baseline.endpoints);
  assert.deepEqual(links(config), ['ab', 'gc', 'pq']);
});

test('individual frame preferences survive global off/on and do not affect descendants', () => {
  const config = fixture();
  config.planes[0].showFrame = false; config.groups[1].showFrame = false;
  config.view.showPlaneFrames = false; config.view.showGroupFrames = false;
  config.view.showPlaneFrames = true; config.view.showGroupFrames = true;
  const result = state(config);
  assert.ok(!result.frames.has(key('plane', 'p')));
  assert.ok(result.frames.has(key('group', 'g')));
  assert.ok(result.frames.has(key('plane', 'q')));
  assert.ok(!result.frames.has(key('group', 'h')));
  assert.equal(result.objects.size, 3);
});

test('hidden parents gate descendants and links, preserving child preferences when restored', () => {
  const config = fixture(); config.objects[1].visible = false;
  config.planes[0].visible = false;
  assert.deepEqual([...state(config).objects], ['c']);
  assert.deepEqual(links(config), []);
  assert.ok(!state(config).frames.has(key('group', 'empty')));
  assert.equal(visibilityNote(config, { kind: 'object', id: 'a' }), 'Hidden');
  assert.equal(config.objects[0].visible, true);
  config.planes[0].visible = true;
  assert.deepEqual([...state(config).objects], ['a', 'c']);
  assert.deepEqual(links(config), ['gc', 'pq']);
  config.groups[0].visible = false;
  assert.deepEqual([...state(config).objects], ['c']);
  assert.deepEqual(links(config), ['pq']);
  assert.ok(state(config).frames.has(key('plane', 'p')));
  config.groups[0].visible = true;
  assert.deepEqual([...state(config).objects], ['a', 'c']);
  assert.equal(config.objects[1].visible, false);
  config.groups[1].visible = false;
  assert.ok(state(config).endpoints.has(key('plane', 'q')), 'a visible plane retains its endpoint even when all its groups are hidden');
  assert.deepEqual(links(config), ['pq']);
});

test('hiding only an object removes its endpoint while keeping the containing frames and independent links', () => {
  const config = fixture(); config.objects[0].visible = false;
  const result = state(config);
  assert.ok(!result.objects.has('a'));
  assert.ok(!result.endpoints.has(key('object', 'a')));
  assert.ok(result.frames.has(key('group', 'g')));
  assert.deepEqual(links(config), ['gc', 'pq']);
  // Hiding a portal does not hide the separate space it points to.
  assert.ok(result.objects.has('c'));
});

test('space and directory filters combine with visibility without overriding saved entity switches', () => {
  const config = fixture(); config.objects[0].visible = false;
  const result = sceneVisibility(config, new Set(['a', 'c']), ['outside']);
  assert.equal(result.objects.size, 0);
  assert.ok(!result.endpoints.has(key('object', 'a')));
  assert.ok(!result.frames.has(key('plane', 'q')));
  assert.ok(result.endpoints.has(key('group', 'empty')));
  assert.equal(visibilityNote(config, { kind: 'object', id: 'c' }), '');
  config.spaceView.active = 'inside';
  assert.ok(state(config).objects.has('b'), 'outer visible spaces remain rendered for dimming');
  assert.ok(!visibleEntities(config).has(key('object', 'a')));
});

test('visibility switches never repack objects or change camera layout bounds', () => {
  const config = fixture();
  const positions = () => {
    const layout = layoutGroups(config);
    return { size: layout.size, y: layout.centerY, objects: layout.groups.flatMap(g => g.objects.map(o => [o.object.id, o.x, o.y, o.z])) };
  };
  const before = positions();
  config.planes[0].visible = false; config.groups[1].showFrame = false;
  config.objects[2].visible = false; config.view.showPlaneFrames = false;
  assert.deepEqual(positions(), before);
});

test('visibility survives export, local saving, and independent space duplication', () => {
  const config = fixture(); config.planes[0].visible = false; config.groups[0].showFrame = false;
  config.objects[1].visible = false; config.view.showGroupFrames = false;
  assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
  const { config: copy, spaceId } = duplicateSpace(config, 'outside', 'Copy');
  const plane = copy.planes.find(p => p.space === spaceId)!;
  assert.equal(plane.visible, false);
  const group = copy.groups.find(g => g.plane === plane.id && g.name === 'Group')!;
  assert.equal(group.showFrame, false);
  assert.equal(copy.objects.find(o => o.group === group.id && o.name === 'B')!.visible, false);
  plane.visible = true; assert.equal(config.planes[0].visible, false);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v); },
  } });
  try { assert.equal(saveConfig(config), true); assert.deepEqual(loadSaved().config, config); }
  finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

test('all visibility fields require booleans and are documented in the JSON schema', () => {
  for (const field of ['planes', 'groups', 'objects'] as const) {
    for (const property of field === 'objects' ? ['visible'] : ['visible', 'showFrame']) {
      for (const bad of [null, 'false', 0, {}]) {
        const config = fixture(); Object.assign(config[field][0], { [property]: bad });
        assert.throws(() => validateConfig(config), new RegExp(`${field}\\[0\\].${property}`));
      }
    }
  }
  for (const property of ['showPlaneFrames', 'showGroupFrames']) for (const bad of [null, 'false', 0]) {
    const config = fixture(); Object.assign(config.view, { [property]: bad });
    assert.throws(() => validateConfig(config), new RegExp(`view.${property}`));
  }
  const schema = JSON.parse(readFileSync(new URL('../public/architecture.schema.json', import.meta.url), 'utf8'));
  for (const field of ['planes', 'groups', 'objects']) assert.deepEqual(schema.properties[field].items.properties.visible.type, 'boolean');
  for (const field of ['planes', 'groups']) assert.equal(schema.properties[field].items.properties.showFrame.default, true);
  for (const field of ['showPlaneFrames', 'showGroupFrames']) assert.equal(schema.properties.view.properties[field].default, true);
});
