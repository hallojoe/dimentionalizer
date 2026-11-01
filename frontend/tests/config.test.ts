import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseConfig, validateConfig } from '../src/config/validate';
import { resolveType } from '../src/catalog/catalog';

const example = () => JSON.parse(readFileSync(new URL('../public/architecture.json', import.meta.url), 'utf8'));
test('the shipped example is valid and survives normalized round-trip export', () => {
  const first = validateConfig(example());
  assert.equal(first.warnings.length, 0);
  assert.deepEqual(parseConfig(JSON.stringify(first.config)).config, first.config);
  assert.equal(first.config.objects.length, 14);
});
test('minimal document supplies presentation, view, group color, and container defaults', () => {
  const { config } = validateConfig({ schemaVersion: 1, groups: [{ id: 'g', name: 'Group' }], objects: [{ id: 'o', name: 'Database', group: 'g' }] });
  assert.equal(config.objects[0].type, 'container');
  assert.equal(config.presentation.brand, 'Dimentionalizer');
  assert.equal(config.view.showNames, true);
  assert.deepEqual(config.connections, []);
});
test('unknown types preserve identity while resolving to container with a warning', () => {
  const input = example(); input.objects[0].type = 'future-object';
  const { config, warnings } = validateConfig(input);
  assert.equal(config.objects[0].type, 'future-object');
  assert.equal(resolveType(config.objects[0].type).id, 'container');
  assert.equal(warnings.length, 1);
});
test('legacy arrays migrate duplicate names to unique stable object IDs', () => {
  const { config, warnings } = validateConfig([{ name: 'service', group: 'Core', text: 'First' }, { name: 'service', group: 'Core', text: 'Second' }]);
  assert.deepEqual(config.objects.map(o => o.id), ['object-1', 'object-2']);
  assert.equal(config.groups.length, 1);
  assert.equal(config.objects[1].description, 'Second');
  assert.deepEqual(config.connections, []);
  assert.equal(warnings.length, 1);
});
test('rejects duplicate object IDs without mutating the input', () => {
  const input = example(); input.objects[1].id = input.objects[0].id;
  const before = structuredClone(input);
  assert.throws(() => validateConfig(input), /duplicate IDs/);
  assert.deepEqual(input, before);
});
test('rejects dangling group and connection references', () => {
  const input = example(); input.objects[0].group = 'missing';
  assert.throws(() => validateConfig(input), /unknown group/);
  const other = example(); other.connections[0].to = 'missing';
  assert.throws(() => validateConfig(other), /unknown object/);
});
test('rejects duplicate group IDs, connection IDs, and self-connections', () => {
  const input = example(); input.groups.push(input.groups[0]);
  assert.throws(() => validateConfig(input), /duplicate IDs/);
  const edges = example(); edges.connections.push(edges.connections[0]);
  assert.throws(() => validateConfig(edges), /duplicate IDs/);
  const self = example(); self.connections[0].to = self.connections[0].from;
  assert.throws(() => validateConfig(self), /itself/);
});
test('rejects malformed document shape, schema, colors, and booleans', () => {
  assert.throws(() => validateConfig(null), /must be an object/);
  const input = example(); input.schemaVersion = 2;
  assert.throws(() => validateConfig(input), /schemaVersion/);
  input.schemaVersion = 1; input.presentation.accent = 'red';
  assert.throws(() => validateConfig(input), /hex color/);
  input.presentation.accent = '#ff00aa'; input.view.effects = 'true';
  assert.throws(() => validateConfig(input), /true or false/);
});
test('limits document size and object count', () => {
  assert.throws(() => parseConfig(' '.repeat(2_000_001)), /2 MB/);
  const input = example(); input.objects = Array.from({ length: 501 }, (_, i) => ({ id: `${i}`, name: 'Object', group: 'data' }));
  assert.throws(() => validateConfig(input), /500/);
});
test('accepts empty documents and rejects malformed JSON with a readable error', () => {
  assert.equal(validateConfig({ schemaVersion: 1, groups: [], objects: [] }).config.objects.length, 0);
  assert.throws(() => parseConfig('{broken'), /Invalid JSON/);
});
test('presentation is configurable and markup remains inert plain data', () => {
  const input = example(); input.presentation.brand = 'Another product'; input.presentation.headline = '<script>alert(1)</script>';
  const { config } = validateConfig(input);
  assert.equal(config.presentation.brand, 'Another product');
  assert.equal(config.presentation.headline, '<script>alert(1)</script>');
});
