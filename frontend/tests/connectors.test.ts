import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { validateConfig, parseConfig } from '../src/config/validate';
import { capacityMaximum, capacityRadius, connectorPath } from '../src/scene/connections';

const input = () => ({ schemaVersion: 1, groups: [{ id: 'g', name: 'G' }], objects: [{ id: 'a', name: 'A', group: 'g' }, { id: 'b', name: 'B', group: 'g' }], connections: [{ id: 'c', from: 'a', to: 'b' }] });

test('old connectors default to normal without adding a capacity decoration', () => {
  const connection = validateConfig(input()).config.connections[0];
  assert.equal(connection.style, 'normal'); assert.equal(connection.capacity, undefined);
  assert.equal(capacityRadius(undefined, 100), 0.025);
});

test('capacity has independent directions, permits zero, and normalizes widths within a unit', () => {
  const document = input();
  const { config } = validateConfig({ ...document, connections: [
    { ...document.connections[0], direction: 'bidirectional', style: 'wobbly', capacity: { out: 100, in: 25, unit: 'people/hour' } },
    { ...document.connections[0], id: 'other', capacity: { out: 1_000_000, unit: 'Mbps' } },
    { ...document.connections[0], id: 'closed', capacity: { out: 0, unit: 'people/hour' } },
  ] });
  assert.equal(capacityMaximum(config.connections, 'people/hour'), 100);
  assert.ok(capacityRadius(100, 100) > capacityRadius(25, 100));
  assert.equal(capacityRadius(0.1, 0.1), capacityRadius(100, 100));
  assert.ok(capacityRadius(25, 100) > capacityRadius(0, 100));
  assert.ok(capacityRadius(1_000_000_000, 1_000_000_000) < 0.3);
  assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
});

test('all styles preserve endpoints, produce distinct paths, and support separated return lanes', () => {
  const a = new THREE.Vector3(0, 10, 0), b = new THREE.Vector3(20, -10, 5);
  const snapshots: string[] = [];
  for (const style of ['normal', 'lightning', 'wobbly'] as const) {
    const path = connectorPath(a, b, style);
    assert.ok(path.getPoint(0).distanceTo(a) < 1e-8); assert.ok(path.getPoint(1).distanceTo(b) < 1e-8);
    const points = path.getPoints(40); assert.ok(points.every(p => [...p].every(Number.isFinite)));
    snapshots.push(JSON.stringify(points));
  }
  assert.equal(new Set(snapshots).size, 3);
  assert.ok(connectorPath(a, b, 'normal', 0.2).getPoint(0.5).distanceTo(connectorPath(a, b, 'normal', -0.2).getPoint(0.5)) > 0.3);
  assert.ok(connectorPath(a, a, 'normal').getLength() > 1);
});

test('malformed capacity and unsupported styles are rejected', () => {
  const document = input();
  for (const patch of [{ style: 'unknown' }, { capacity: {} }, { capacity: null }, { capacity: { out: -1 } }, { capacity: { in: Infinity } }, { capacity: { out: '5' } }, { capacity: { out: 1, unit: 'x'.repeat(41) } }]) {
    assert.throws(() => validateConfig({ ...document, connections: [{ ...document.connections[0], ...patch }] }), /connections\[0\]/);
  }
});
