import assert from 'node:assert/strict';
import test from 'node:test';
import { validateConfig, parseConfig } from '../src/config/validate';
import { resolveSpacing } from '../src/config/spacing';
import { layoutGroups } from '../src/scene/layout';
import type { Spacing } from '../src/config/types';

const spacing = (mode: Spacing['mode'], value: number, target: Spacing['target'] = 'self'): Spacing => ({ mode, value, target });
const input = () => ({ schemaVersion: 1, groups: [{ id: 'g', name: 'G' }], objects: [
  { id: 'a', name: 'A', group: 'g' }, { id: 'b', name: 'B', group: 'g' },
] });

test('omitting spacing preserves baseline positions and does not emit explicit overrides', () => {
  const { config } = validateConfig(input()), layout = layoutGroups(config);
  assert.equal(config.objects[0].spacing, undefined);
  assert.equal(config.groups[0].spacing, undefined);
  assert.equal(layout.groups[0].width, 15); assert.equal(layout.groups[0].depth, 7.5);
  assert.deepEqual(layout.groups[0].objects.map(o => [o.x, o.y, o.z]), [[-3, 0, 0], [3, 0, 0]]);
  config.planes[0].sizing = 'locked';
  assert.deepEqual(layoutGroups(config).warnings, []);
});

test('children defaults apply directly, explicit zero wins, and an own children rule blocks inheritance', () => {
  const parent = { spacing: spacing('padding', 4, 'children') };
  assert.equal(resolveSpacing({}, parent).padding, 4);
  assert.equal(resolveSpacing({}, parent).inherited, true);
  assert.equal(resolveSpacing({ spacing: spacing('margin', 0) }, parent).padding, 0);
  assert.equal(resolveSpacing({ spacing: spacing('margin', 0) }, parent).inherited, false);
  assert.equal(resolveSpacing({ spacing: spacing('margin', 2, 'children') }, parent).padding, 0);
  assert.equal(resolveSpacing({}, {}).padding, 0);
  assert.equal(resolveSpacing({}, { spacing: spacing('padding', 4) }).padding, 0);
});

test('group margin reserves outside room while padding expands the visible platform', () => {
  const { config } = validateConfig(input());
  const baseline = layoutGroups(config);
  config.groups[0].spacing = spacing('margin', 4);
  const margin = layoutGroups(config);
  assert.equal(margin.groups[0].width, baseline.groups[0].width);
  assert.equal(margin.planes[0].width, baseline.planes[0].width + 8);
  config.groups[0].spacing = spacing('padding', 4);
  const padding = layoutGroups(config);
  assert.equal(padding.groups[0].width, baseline.groups[0].width + 8);
  assert.deepEqual(padding.groups[0].objects, baseline.groups[0].objects);
});

test('all object children receive spacing unless they override it; zero removes the inherited extra', () => {
  const { config } = validateConfig(input());
  config.groups[0].spacing = spacing('margin', 2, 'children');
  let layout = layoutGroups(config);
  assert.equal(layout.groups[0].objects[1].x - layout.groups[0].objects[0].x, 10);
  config.objects[0].spacing = spacing('padding', 0);
  layout = layoutGroups(config);
  assert.equal(layout.groups[0].objects[1].x - layout.groups[0].objects[0].x, 8);
  config.objects[1].spacing = spacing('margin', 0);
  layout = layoutGroups(config);
  assert.equal(layout.groups[0].objects[1].x - layout.groups[0].objects[0].x, 6);
});

test('variable cell sizes avoid overlaps across columns and rows and preserve all elevations', () => {
  const { config } = validateConfig({ ...input(), objects: Array.from({ length: 9 }, (_, i) => ({ id: `o${i}`, name: 'O', group: 'g', elevation: i - 4, spacing: spacing(i % 2 ? 'padding' : 'margin', i) })) });
  config.planes[0].elevation = 10; config.groups[0].elevation = -3;
  const layout = layoutGroups(config), entries = layout.groups[0].objects;
  for (const [i, a] of entries.entries()) {
    assert.equal(a.y, 7 + i - 4);
    for (const [j, b] of entries.entries()) if (i < j) {
      const halfWidthSum = 6 + i + j, halfDepthSum = 4.5 + i + j;
      assert.ok(Math.abs(a.x - b.x) >= halfWidthSum || Math.abs(a.z - b.z) >= halfDepthSum, `${i} overlaps ${j}`);
    }
  }
});

test('plane padding expands auto-fit dimensions; locked dimensions remain fixed and warn about spacing overflow', () => {
  const { config } = validateConfig(input()), baseline = layoutGroups(config);
  config.planes[0].spacing = spacing('padding', 5);
  const auto = layoutGroups(config);
  assert.equal(auto.planes[0].width, baseline.planes[0].width + 10);
  Object.assign(config.planes[0], { sizing: 'locked', width: 30, height: 30, spacing: spacing('padding', 10) });
  const locked = layoutGroups(config);
  assert.equal(locked.planes[0].width, 30); assert.equal(locked.planes[0].height, 30);
  assert.equal(locked.planes[0].overflow, true);
  assert.match(locked.warnings[0], /spacing/);
});

test('space child defaults affect planes and stop before groups; plane own settings override them', () => {
  const { config } = validateConfig(input()), baseline = layoutGroups(config);
  config.spaces[0].spacing = spacing('padding', 3, 'children');
  const inherited = layoutGroups(config);
  assert.equal(inherited.planes[0].width, baseline.planes[0].width + 6);
  assert.equal(inherited.groups[0].width, baseline.groups[0].width);
  config.planes[0].spacing = spacing('margin', 0);
  assert.equal(layoutGroups(config).planes[0].width, baseline.planes[0].width);
});

test('space margin and padding keep their distinct outside and inside meanings', () => {
  const { config } = validateConfig(input()), baseline = layoutGroups(config);
  config.spaces[0].spacing = spacing('margin', 8);
  const margin = layoutGroups(config);
  assert.equal(margin.spaces[0].width, baseline.spaces[0].width);
  assert.ok(margin.size > baseline.size);
  config.spaces[0].spacing = spacing('padding', 8);
  assert.equal(layoutGroups(config).spaces[0].width, baseline.spaces[0].width + 16);
});

test('malformed spacing is rejected at each level and objects cannot target nonexistent children', () => {
  for (const bad of [null, [], {}, { value: -1 }, { value: Infinity }, { value: '2' }, { value: 1001 }, { mode: null, value: 1 }, { mode: 'gap', value: 2 }, { target: 'all', value: 2 }]) {
    for (const kind of ['spaces', 'planes', 'groups', 'objects'] as const) {
      const { config } = validateConfig(input());
      Object.assign(config[kind][0], { spacing: bad });
      assert.throws(() => validateConfig(config), /spacing/);
    }
  }
  const { config } = validateConfig(input()); config.objects[0].spacing = spacing('margin', 1, 'children');
  assert.throws(() => validateConfig(config), /objects do not own layout children/);
});

test('fractional spacing and explicit zero overrides survive normalized export', () => {
  const { config } = validateConfig(input());
  config.groups[0].spacing = spacing('margin', 2.5, 'children'); config.objects[0].spacing = spacing('padding', 0);
  assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
});
