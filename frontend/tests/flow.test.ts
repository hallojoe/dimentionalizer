import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { parseConfig, validateConfig } from '../src/config/validate';
import { resolveFlow } from '../src/config/flow';
import { flowFrame, createFlowVisual } from '../src/scene/flow';
import { disposeResources } from '../src/scene/resources';
import { modelVisual } from '../src/catalog/models';
import { appendSpaces, duplicateSpace } from '../src/config/spaces';
import { saveConfig, loadSaved } from '../src/config/storage';

const document = () => ({ schemaVersion: 1, groups: [{ id: 'g', name: 'Group' }], objects: [
  { id: 'a', name: 'Client', group: 'g' }, { id: 'b', name: 'Email service', group: 'g', type: 'email' },
], connections: [{ id: 'ab', from: 'a', to: 'b' }] });

test('existing connections use a message model; explicit choices remain independent from endpoint types', () => {
  const input = document(), old = validateConfig(input).config.connections[0];
  assert.equal(old.flow, undefined); assert.equal(resolveFlow(old).out, 'message');
  const { config } = validateConfig({ ...input, connections: [{ ...input.connections[0], direction: 'bidirectional', flow: { out: 'key', in: 'email' } }] });
  assert.equal(resolveFlow(config.connections[0]).out, 'key'); assert.equal(resolveFlow(config.connections[0]).in, 'email');
  delete config.connections[0].flow!.in;
  assert.equal(resolveFlow(config.connections[0]).in, 'key');
  assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
});

test('flow validation rejects malformed choices and timing, preserves unknown types with a warning', () => {
  const input = document();
  for (const flow of [null, [], 'email', { out: '' }, { in: null }, { size: 0 }, { size: 7 }, { duration: 0 }, { duration: 61 }, { gap: -1 }, { gap: 31 }, { size: NaN }, { duration: Infinity }, { gap: '1' }]) {
    assert.throws(() => validateConfig({ ...input, connections: [{ ...input.connections[0], flow }] }), /connections\[0\].flow/);
  }
  const { config, warnings } = validateConfig({ ...input, connections: [{ ...input.connections[0], flow: { out: 'future-model', gap: 0 } }] });
  assert.equal(config.connections[0].flow!.out, 'future-model'); assert.equal(config.connections[0].flow!.gap, 0);
  assert.equal(warnings.length, 1); assert.match(warnings[0], /unknown flow type/);
});

test('models start at zero, finish at zero, remain invisible through the pause, and reset without a visible teleport', () => {
  const timing = { duration: 5, gap: 1 };
  assert.deepEqual(flowFrame(-1, timing), { progress: 0, presence: 0 });
  assert.deepEqual(flowFrame(0, timing), { progress: 0, presence: 0 });
  assert.deepEqual(flowFrame(5, timing), { progress: 1, presence: 0 });
  assert.deepEqual(flowFrame(5.5, timing), { progress: 1, presence: 0 });
  assert.deepEqual(flowFrame(6, timing), { progress: 0, presence: 0 });
  assert.equal(flowFrame(2.5, timing).presence, 1);
  assert.ok(flowFrame(0.05, timing).presence < flowFrame(0.2, timing).presence);
  assert.ok(flowFrame(4.95, timing).presence < flowFrame(4.8, timing).presence);
  assert.ok(flowFrame(1e-6, timing).presence < 1e-8);
  assert.ok(flowFrame(5 - 1e-6, timing).presence < 1e-8);
  assert.equal(flowFrame(5, { duration: 5, gap: 0 }).presence, 0);
});

test('forward and return models ease in opposite directions; reduced motion stays readable and stationary', () => {
  const timing = { duration: 5, gap: 1 };
  let previous = 0;
  for (let t = 0; t <= 5; t += 0.05) {
    const a = flowFrame(t, timing), b = flowFrame(t, timing, true);
    assert.ok(a.progress >= previous && a.progress <= 1);
    assert.ok(Math.abs(a.progress + b.progress - 1) < 1e-10);
    assert.equal(a.presence, b.presence); assert.ok(a.presence >= 0 && a.presence <= 1);
    previous = a.progress;
  }
  assert.deepEqual(flowFrame(0, timing, false, true), flowFrame(100, timing, false, true));
  assert.equal(flowFrame(100, timing, true, true).presence, 1);
  assert.notEqual(flowFrame(0, timing, true, true).progress, flowFrame(0, timing, false, true).progress);
});

test('connection visuals center and fit real models without a pick box, in both themes', () => {
  for (const theme of ['wire', 'textured'] as const) for (const type of ['key', 'email', 'response', 'unknown']) {
    const visual = createFlowVisual(type, '#61d8ee', [], theme);
    assert.equal(visual.root.visible, false);
    visual.appearance(1, 1.8, false);
    const box = new THREE.Box3().setFromObject(visual.root), size = box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(...size) - 1.8) < 1e-6);
    assert.ok(box.getCenter(new THREE.Vector3()).length() < 1e-6);
    visual.root.traverse(object => {
      if (object instanceof THREE.Mesh) assert.ok((Array.isArray(object.material) ? object.material : [object.material]).every(m => m.visible), 'no invisible hit mesh');
    });
    visual.appearance(0, 1.8, false);
    assert.equal(visual.root.scale.length(), 0);
    disposeResources(visual.root);
  }
});

test('fade opacity composes with space dimming and restores without compounding', () => {
  const visual = createFlowVisual('email', '#61d8ee', [], 'textured');
  const materials = new Set<THREE.Material>();
  visual.root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); });
  const original = [...materials].map(m => m.opacity);
  visual.appearance(0.5, 1, true);
  [...materials].forEach((m, i) => { assert.ok(Math.abs(m.opacity - original[i] * 0.5 * 0.12) < 1e-10); assert.equal(m.depthWrite, false); });
  visual.appearance(0.5, 1, true);
  visual.appearance(1, 1, false);
  assert.deepEqual([...materials].map(m => m.opacity), original);
  disposeResources(visual.root);
});

test('custom model replacement disposes the fallback and preserves miniature centering and lifecycle', () => {
  const visual = createFlowVisual('email', '#61d8ee', [], 'textured');
  let removed = 0;
  visual.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => removed++); });
  const asset = new THREE.BoxGeometry(10, 20, 5), model = modelVisual([asset], '#61d8ee', [0, 30, 0], 'textured');
  visual.setModel(model); assert.ok(removed > 0);
  visual.appearance(1, 2, false);
  const bounds = new THREE.Box3().setFromObject(visual.root);
  assert.ok(bounds.getCenter(new THREE.Vector3()).length() < 1e-6);
  assert.ok(Math.abs(Math.max(...bounds.getSize(new THREE.Vector3())) - 2) < 1e-6);
  visual.appearance(0, 2, false);
  model.traverse(object => { if (object instanceof THREE.Mesh) assert.equal((object.material as THREE.Material).opacity, 0); });
  disposeResources(visual.root); asset.dispose();
});

test('custom types used only by flows survive duplication and are remapped on conflicting template imports', () => {
  const source = validateConfig({ ...document(), objectTypes: [{ id: 'payload', name: 'Payload', shape: 'key', model: { url: 'models/key.glb' } }], connections: [{ ...document().connections[0], flow: { out: 'payload', in: 'email' } }] }).config;
  const target = validateConfig({ ...document(), objectTypes: [{ id: 'payload', name: 'Other meaning', shape: 'product' }] }).config;
  const { config: imported } = appendSpaces(target, source, 'Imported');
  assert.equal(imported.connections[1].flow!.out, 'payload-2');
  assert.ok(imported.objectTypes.some(t => t.id === 'payload-2' && t.model?.url === 'models/key.glb'));
  const { config: duplicate } = duplicateSpace(source, source.spaces[0].id, 'Copy');
  assert.equal(duplicate.connections[1].flow!.out, 'payload');
  assert.ok(duplicate.objectTypes.some(t => t.id === 'payload'));
  duplicate.connections[1].flow!.size = 3;
  assert.notEqual(duplicate.connections[0].flow!.size, 3);
  assert.deepEqual(parseConfig(JSON.stringify(imported)).config, imported);
});

test('browser storage retains per-direction models and fractional animation settings', () => {
  const config = validateConfig({ ...document(), connections: [{ ...document().connections[0], flow: { out: 'key', in: 'email', duration: 2.5, size: 1.8, gap: 0.4 } }] }).config;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v); } } });
  try { assert.equal(saveConfig(config), true); assert.deepEqual(loadSaved().config, config); }
  finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});
