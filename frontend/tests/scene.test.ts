import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { objectCatalog } from '../src/catalog/catalog';
import { createObjectVisual } from '../src/catalog/geometry';
import { layoutGroups } from '../src/scene/layout';
import { validateConfig } from '../src/config/validate';

test('every catalog entry constructs bounded, independently disposable geometry', () => {
  assert.equal(new Set(objectCatalog.map(t => t.id)).size, objectCatalog.length);
  for (const type of objectCatalog) {
    const visual = createObjectVisual(type.id, '#b8ff6c');
    visual.highlight(true); visual.highlight(false);
    const bounds = new THREE.Box3().setFromObject(visual.root);
    assert.ok(bounds.min.y >= -0.01, `${type.id} below platform`);
    assert.ok(bounds.max.y <= 2.7, `${type.id} above common envelope`);
    assert.ok(bounds.max.x - bounds.min.x <= 4.9, `${type.id} too wide`);
    assert.ok(bounds.max.z - bounds.min.z <= 3.5, `${type.id} too deep`);
    let primitives = 0;
    visual.root.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
        primitives++;
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose());
      }
    });
    assert.ok(primitives > 2);
  }
});
test('unknown geometry uses the same container fallback as catalog metadata', () => {
  const known = createObjectVisual('container', '#ffffff');
  const future = createObjectVisual('future-type', '#ffffff');
  assert.equal(known.root.children.length, future.root.children.length);
});
test('layout is deterministic and keeps variable-size group platforms apart', () => {
  const groups = Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, name: `Group ${i}` }));
  const objects = groups.flatMap((g, i) => Array.from({ length: i * 3 + 1 }, (_, j) => ({ id: `${i}-${j}`, name: 'Object', group: g.id })));
  const config = validateConfig({ schemaVersion: 1, groups, objects }).config;
  const result = layoutGroups(config);
  assert.deepEqual(layoutGroups(config), result);
  for (const [index, a] of result.groups.entries()) {
    for (const b of result.groups.slice(index + 1)) {
      const separatedX = Math.abs(a.x - b.x) >= (a.width + b.width) / 2;
      const separatedZ = Math.abs(a.z - b.z) >= (a.depth + b.depth) / 2;
      assert.ok(separatedX || separatedZ, `${a.id} overlaps ${b.id}`);
    }
    for (const item of a.objects) {
      assert.ok(Math.abs(item.x - a.x) + 2.4 < a.width / 2);
      assert.ok(Math.abs(item.z - a.z) + 1.75 < a.depth / 2);
    }
  }
});
test('empty layouts have a usable finite camera scale', () => {
  const config = validateConfig({ schemaVersion: 1, groups: [], objects: [] }).config;
  assert.equal(layoutGroups(config).size, 22);
});
