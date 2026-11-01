import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseConfig, validateConfig } from '../src/config/validate';
import { addBlankSpace, appendSpaces, duplicateSpace, enterSpace, toggleSpace } from '../src/config/spaces';
import { endpointRef, endpointSpace } from '../src/config/connections';
import { layoutGroups, spaceViewBounds } from '../src/scene/layout';
import { connectionAnchor } from '../src/scene/connections';
import { loadSaved, saveConfig } from '../src/config/storage';

const home = () => parseConfig(readFileSync(new URL('../public/presets/home-neighborhood.json', import.meta.url), 'utf8')).config;
const blank = () => validateConfig({ schemaVersion: 1, groups: [], objects: [] }).config;

test('old documents receive one space, default membership, and a visible overview', () => {
  const config = blank();
  assert.deepEqual(config.spaces, [{ id: 'main', name: 'Main space', description: '' }]);
  assert.deepEqual(config.spaceView, { visible: ['main'], active: null });
  assert.equal(config.planes[0].space, 'main');
  assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
});

test('adding a blank space is independent and preserves the existing document', () => {
  const config = home(), before = structuredClone(config);
  const added = addBlankSpace(config, 'Quiet room');
  assert.deepEqual(config, before);
  assert.equal(added.config.spaces.length, 3);
  assert.equal(added.config.spaceView.active, added.spaceId);
  assert.ok(added.config.planes.some(p => p.space === added.spaceId));
  assert.deepEqual(added.config.objects, config.objects);
  assert.deepEqual(validateConfig(added.config).warnings, []);
  assert.throws(() => addBlankSpace(config, '   '), /name/);
});

test('multi-space template import remaps portals, typed endpoints, and every parent relationship', () => {
  const source = home();
  const added = appendSpaces(blank(), source, 'Second neighborhood');
  const imported = added.config.objects.find(o => o.name === 'Home · click to enter')!;
  assert.notEqual(imported.linkedSpace, 'inside-home');
  assert.equal(added.config.spaces.find(s => s.id === imported.linkedSpace)!.name, 'Second neighborhood · Inside the home');
  assert.equal(endpointSpace(added.config, imported.id), added.spaceId);
  assert.ok(added.config.connections.some(c => endpointRef(c.to).kind === 'space' && endpointRef(c.to).id === imported.linkedSpace));
  assert.deepEqual(parseConfig(JSON.stringify(added.config)).config, added.config);
  const again = appendSpaces(added.config, source, 'Second neighborhood');
  for (const entries of [again.config.spaces, again.config.planes, again.config.groups, again.config.objects, again.config.connections]) assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
});

test('duplication copies only one space, preserves its external portals, and omits boundary-crossing connectors', () => {
  const source = home(), before = structuredClone(source);
  const { config, spaceId } = duplicateSpace(source, 'neighborhood', 'Twin neighborhood');
  const copied = config.objects.filter(o => endpointSpace(config, o.id) === spaceId);
  assert.equal(copied.length, 4);
  assert.equal(copied.find(o => o.type === 'home')!.linkedSpace, 'inside-home');
  const copiedIds = new Set(copied.map(o => o.id));
  const copiedConnections = config.connections.filter(c => copiedIds.has(endpointRef(c.from).id));
  assert.equal(copiedConnections.length, 3);
  copied[0].name = 'Changed';
  assert.deepEqual(source, before);
  assert.throws(() => duplicateSpace(source, 'missing', 'Bad'), /existing space/);
});

test('template custom types with conflicting IDs get independent definitions and object references', () => {
  const make = (name: string, shape: string) => validateConfig({ schemaVersion: 1, objectTypes: [{ id: 'person', name, shape }], groups: [{ id: 'g', name: 'G' }], objects: [{ id: 'o', name: 'O', type: 'person', group: 'g' }] }).config;
  const first = make('Adult', 'adult'), second = make('Child', 'child');
  const { config, spaceId } = appendSpaces(first, second, 'Imported');
  assert.equal(config.objectTypes.length, 2);
  assert.equal(config.objects[0].type, 'person');
  const imported = config.objects.find(o => endpointSpace(config, o.id) === spaceId)!;
  assert.notEqual(imported.type, 'person');
  assert.equal(config.objectTypes.find(t => t.id === imported.type)!.shape, 'child');
  assert.equal(appendSpaces(first, first, 'Same vocabulary').config.objectTypes.length, 1);
});

test('portal navigation retains outer visibility and supports restoring the previous view without mutating it', () => {
  const original = { visible: ['neighborhood'], active: 'neighborhood' };
  const inside = enterSpace(original, 'inside-home');
  assert.deepEqual(inside, { visible: ['neighborhood', 'inside-home'], active: 'inside-home' });
  assert.deepEqual(original, { visible: ['neighborhood'], active: 'neighborhood' });
  assert.deepEqual(enterSpace(inside, 'inside-home'), inside);
  assert.deepEqual(toggleSpace(inside, 'inside-home', false), { visible: ['neighborhood'], active: null });
  assert.throws(() => toggleSpace(original, 'neighborhood', false), /at least one/);
});

test('space layout separates footprints, preserves elevation composition, and focuses only selected spaces', () => {
  const config = home(); config.planes[1].elevation = 10; config.groups[1].elevation = -3; config.objects.find(o => o.id === 'adult')!.elevation = -2;
  const layout = layoutGroups(config), [outside, inside] = layout.spaces;
  assert.ok(Math.abs(outside.x - inside.x) >= (outside.width + inside.width) / 2 || Math.abs(outside.z - inside.z) >= (outside.depth + inside.depth) / 2);
  assert.equal(layout.groups.flatMap(g => g.objects).find(o => o.object.id === 'adult')!.y, 5);
  const bounds = spaceViewBounds([inside]);
  assert.equal(bounds.x, inside.x); assert.equal(bounds.z, inside.z);
  assert.ok(spaceViewBounds(layout.spaces).size > bounds.size);
  assert.deepEqual(connectionAnchor(layout, { kind: 'space', id: inside.id }), [inside.x, 0.1, inside.z]);
});

test('invalid spaces, view state, memberships, portals, and self-portals are rejected', () => {
  for (const patch of [{ spaces: [] }, { spaces: null }, { spaces: [{ id: 'x', name: 'X' }, { id: 'x', name: 'X' }] },
    { spaceView: { visible: [] } }, { spaceView: { visible: ['missing'] } }, { spaceView: { visible: ['neighborhood'], active: 'inside-home' } }]) {
    assert.throws(() => validateConfig({ ...home(), ...patch }), /space/i);
  }
  const badParent = home(); badParent.planes[0].space = 'missing'; assert.throws(() => validateConfig(badParent), /unknown space/);
  for (const target of ['missing', 'neighborhood']) {
    const config = home(); config.objects.find(o => o.id === 'home')!.linkedSpace = target;
    assert.throws(() => validateConfig(config), /linkedSpace/);
  }
});

test('saved documents restore visible spaces, active focus, portals, and capacity decorations', () => {
  const config = home(); config.spaceView = enterSpace(config.spaceView, 'inside-home');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } } });
  try { assert.equal(saveConfig(config), true); assert.deepEqual(loadSaved().config, config); }
  finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});
