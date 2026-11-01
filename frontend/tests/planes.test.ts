import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseConfig, validateConfig } from '../src/config/validate';
import { endpointKey } from '../src/config/connections';
import { layoutGroups, planeViewBounds } from '../src/scene/layout';
import { connectionAnchor, packetProgress } from '../src/scene/connections';

const input = () => ({
  schemaVersion: 1,
  planes: [{ id: 'upper', name: 'Upper', elevation: 10 }, { id: 'lower', name: 'Lower', elevation: -10 }],
  groups: [{ id: 'a', name: 'A', plane: 'upper', elevation: -3 }, { id: 'b', name: 'B', plane: 'lower' }],
  objects: [{ id: 'one', name: 'One', group: 'a', elevation: -2 }, { id: 'two', name: 'Two', group: 'b' }],
});

test('old documents retain their elevations on an implicit auto-fit plane and forward connections', () => {
  const { config } = validateConfig({ schemaVersion: 1, groups: [{ id: 'g', name: 'G', elevation: 10 }], objects: [
    { id: 'a', name: 'A', group: 'g', elevation: -10 }, { id: 'b', name: 'B', group: 'g' },
  ], connections: [{ id: 'ab', from: 'a', to: 'b' }] });
  assert.equal(config.planes[0].sizing, 'auto');
  assert.equal(config.planes[0].elevation, 0);
  assert.equal(config.groups[0].plane, config.planes[0].id);
  assert.equal(config.connections[0].direction, 'forward');
  assert.equal(config.connections[0].from, 'a');
  assert.deepEqual(layoutGroups(config).groups[0].objects.map(o => o.y), [0, 10]);
});

test('world elevations compose plane, group, and item offsets; moving one plane leaves others unchanged', () => {
  const { config } = validateConfig(input());
  const before = layoutGroups(config);
  assert.equal(before.planes[0].y, 10);
  assert.equal(before.groups[0].y, 7);
  assert.equal(before.groups[0].objects[0].y, 5);
  config.planes[0].elevation = -10;
  const after = layoutGroups(config);
  assert.equal(after.groups[0].y, -13);
  assert.equal(after.groups[0].objects[0].y, -15);
  assert.deepEqual(after.planes[1], before.planes[1]);
  assert.deepEqual(after.groups.map(g => [g.x, g.z]), before.groups.map(g => [g.x, g.z]));
  config.groups[0].plane = 'lower';
  assert.equal(layoutGroups(config).planes[0].groups.length, 0);
  assert.equal(layoutGroups(config).planes[1].groups.length, 2);
});

test('auto-fit expands to contain groups with padding and respects minimum dimensions', () => {
  const { config } = validateConfig(input());
  config.objects.push(...Array.from({ length: 40 }, (_, i) => ({ id: `extra-${i}`, name: 'Extra', group: 'a' })));
  config.planes[1].width = 100;
  const layout = layoutGroups(config);
  assert.ok(layout.planes[0].width > 20);
  assert.equal(layout.planes[1].width, 100);
  for (const plane of layout.planes) for (const group of plane.groups) {
    assert.ok(Math.abs(group.x - plane.x) + group.width / 2 + 4 <= plane.width / 2);
    assert.ok(Math.abs(group.z - plane.z) + group.depth / 2 + 4 <= plane.depth / 2);
  }
  assert.deepEqual(layout.warnings, []);
});

test('locked dimensions stay fixed, report overflow, and reserve contents when packing neighboring planes', () => {
  const { config } = validateConfig(input());
  Object.assign(config.planes[0], { sizing: 'locked', width: 2, height: 3 });
  const layout = layoutGroups(config);
  const [locked, other] = layout.planes;
  assert.equal(locked.width, 2);
  assert.equal(locked.height, 3);
  assert.equal(locked.overflow, true);
  assert.equal(layout.warnings.length, 1);
  const group = locked.groups[0];
  assert.ok(Math.abs(group.x - other.x) >= (group.width + other.width) / 2 || Math.abs(group.z - other.z) >= (group.depth + other.depth) / 2);
  assert.ok(planeViewBounds(locked).size >= group.width);
});

test('empty planes are valid and camera bounds include extreme child elevations', () => {
  const { config } = validateConfig(input());
  config.objects[0].elevation = -100;
  const plane = layoutGroups(config).planes[0];
  assert.ok(planeViewBounds(plane).size >= 103);
  const empty = layoutGroups(validateConfig({ schemaVersion: 1, planes: [{ id: 'empty', name: 'Empty' }], groups: [], objects: [] }).config);
  assert.equal(empty.planes[0].width, 20);
  assert.equal(empty.planes[0].height, 20);
  assert.equal(empty.planes[0].overflow, false);
});

test('typed endpoints distinguish shared IDs and resolve anchors at the correct hierarchy level', () => {
  const { config } = validateConfig({ schemaVersion: 1,
    planes: [{ id: 'same', name: 'Plane', elevation: 10 }],
    groups: [{ id: 'same', name: 'Group', elevation: 5 }],
    objects: [{ id: 'same', name: 'Object', group: 'same', elevation: -3 }],
    connections: [{ id: 'pg', from: { kind: 'plane', id: 'same' }, to: { kind: 'group', id: 'same' }, direction: 'bidirectional' },
      { id: 'go', from: { kind: 'group', id: 'same' }, to: 'same' }],
  });
  const layout = layoutGroups(config);
  assert.equal(connectionAnchor(layout, { kind: 'plane', id: 'same' })[1], 10.1);
  assert.equal(connectionAnchor(layout, { kind: 'group', id: 'same' })[1], 15.1);
  assert.equal(connectionAnchor(layout, 'same')[1], 13.5);
  assert.equal(endpointKey('same'), endpointKey({ kind: 'object', id: 'same' }));
  assert.notEqual(endpointKey('same'), endpointKey({ kind: 'plane', id: 'same' }));
});

test('invalid plane definitions and parent references are rejected before applying', () => {
  for (const patch of [{ width: 0 }, { height: Infinity }, { elevation: '10' }, { sizing: 'fixed' }, { sizing: null },
    { decoration: { color: 'red' } }, { decoration: { opacity: 1.1 } }, { decoration: { grid: 'true' } }, { decoration: null }]) {
    const document = input();
    assert.throws(() => validateConfig({ ...document, planes: [{ ...document.planes[0], ...patch }, document.planes[1]] }), /planes\[0\]/);
  }
  assert.throws(() => validateConfig({ ...input(), planes: null }), /planes must be an array/);
  const document = input(); document.groups[0].plane = 'absent';
  assert.throws(() => validateConfig(document), /unknown plane/);
  assert.throws(() => validateConfig({ ...input(), planes: [input().planes[0], input().planes[0]] }), /duplicate IDs/);
});

test('invalid typed endpoints, mixed shorthand self-links, and directions are rejected', () => {
  const edge = { id: 'edge', from: 'one', to: 'two' };
  for (const patch of [{ from: { kind: 'plane', id: 'missing' } }, { to: { kind: 'group', id: 'missing' } },
    { from: { kind: 'unknown', id: 'one' } }, { to: { kind: 'object', id: 'one' } }, { direction: 'reverse' }, { direction: null }]) {
    assert.throws(() => validateConfig({ ...input(), connections: [{ ...edge, ...patch }] }), /connections\[0\]/);
  }
});

test('single-direction packets progress forward; bidirectional packets traverse opposite directions', () => {
  assert.deepEqual(packetProgress(0.25, 'forward'), [0.25]);
  assert.deepEqual(packetProgress(0.25, 'bidirectional'), [0.25, 0.75]);
  assert.deepEqual(packetProgress(0.5, 'bidirectional'), [0.5, 0.5]);
  assert.deepEqual(packetProgress(1.25, 'bidirectional'), [0.25, 0.75]);
});

test('the multi-plane example round-trips dimensions, decoration, parents, and directions', () => {
  const source = readFileSync(new URL('../public/examples/planes.json', import.meta.url), 'utf8');
  const { config, warnings } = parseConfig(source);
  assert.deepEqual(warnings, []);
  assert.equal(config.planes.length, 3);
  assert.ok(config.planes.some(p => p.sizing === 'locked'));
  assert.ok(config.connections.some(c => c.direction === 'bidirectional'));
  assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
  assert.deepEqual(layoutGroups(config).warnings, []);
});
