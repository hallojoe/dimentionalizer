import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { objectCatalog } from '../src/catalog/catalog';
import { createObjectVisual } from '../src/catalog/geometry';
import { grainTexture, modelThemes, highlightModel } from '../src/catalog/themes';
import { ModelLibrary, modelVisual } from '../src/catalog/models';
import { disposeResources } from '../src/scene/resources';
import { parseConfig, validateConfig } from '../src/config/validate';
import { loadSaved, saveConfig } from '../src/config/storage';

function surfaces(root: THREE.Object3D): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] {
  const result: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) result.push(object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>); });
  return result;
}

test('old documents retain Wire; Textured validates, round-trips, and persists', () => {
  const input = { schemaVersion: 1, groups: [], objects: [] };
  assert.equal(validateConfig(input).config.view.modelTheme, 'wire');
  assert.equal(validateConfig([{ name: 'Legacy', group: 'Group' }]).config.view.modelTheme, 'wire');
  const config = validateConfig({ ...input, view: { modelTheme: 'textured', showGroupFrames: false } }).config;
  assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
  for (const value of [null, false, 1, '', 'missing', {}]) assert.throws(() => validateConfig({ ...input, view: { modelTheme: value } }), /view.modelTheme/);
  const schema = JSON.parse(readFileSync(new URL('../public/architecture.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(schema.properties.view.properties.modelTheme.enum, modelThemes.map(theme => theme.id));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); },
  } });
  try { assert.equal(saveConfig(config), true); assert.deepEqual(loadSaved().config, config); }
  finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

test('every built-in supports both themes with stable bounds and invisible hit targets', () => {
  for (const type of objectCatalog) {
    const wire = createObjectVisual(type.id, '#61d8ee');
    const textured = createObjectVisual(type.id, '#61d8ee', [], 'textured');
    assert.equal(surfaces(wire.root).length, 0, type.id);
    assert.ok(surfaces(textured.root).length > 0, type.id);
    const a = new THREE.Box3().setFromObject(wire.root), b = new THREE.Box3().setFromObject(textured.root);
    assert.ok(a.min.distanceTo(b.min) < 1e-6 && a.max.distanceTo(b.max) < 1e-6, `${type.id}: theme changes bounds`);
    assert.equal((textured.hit.material as THREE.Material).visible, false);
    for (const mesh of surfaces(textured.root)) {
      assert.ok(mesh.material.map instanceof THREE.DataTexture);
      assert.ok(mesh.geometry.hasAttribute('normal') && mesh.geometry.hasAttribute('uv'));
      assert.equal(mesh.material.transparent, false);
    }
    textured.highlight(true);
    assert.ok(surfaces(textured.root).every(mesh => mesh.material.emissiveIntensity === 0.24));
    textured.highlight(false);
    assert.ok(surfaces(textured.root).every(mesh => mesh.material.emissiveIntensity === 0.035));
    disposeResources(wire.root); disposeResources(textured.root);
  }
});

test('the procedural texture is deterministic, non-uniform, and independently owned', () => {
  const a = grainTexture(), b = grainTexture();
  assert.notEqual(a, b); assert.notEqual(a.image.data, b.image.data);
  assert.deepEqual(a.image.data, b.image.data);
  assert.ok(new Set(a.image.data).size > 20);
  assert.equal(a.wrapS, THREE.RepeatWrapping); assert.equal(a.wrapT, THREE.RepeatWrapping);
  assert.equal(a.colorSpace, THREE.SRGBColorSpace);
  a.dispose(); b.dispose();
});

test('disposing a textured visual releases its shared material and texture once, leaving other visuals intact', () => {
  const a = createObjectVisual('family', '#61d8ee', [], 'textured'), b = createObjectVisual('family', '#61d8ee', [], 'textured');
  const material = surfaces(a.root)[0].material, texture = material.map!;
  assert.ok(surfaces(a.root).every(mesh => mesh.material === material));
  assert.notEqual(texture, surfaces(b.root)[0].material.map);
  let texturesDisposed = 0, materialsDisposed = 0, otherDisposed = 0;
  texture.addEventListener('dispose', () => texturesDisposed++);
  material.addEventListener('dispose', () => materialsDisposed++);
  surfaces(b.root)[0].material.map!.addEventListener('dispose', () => otherDisposed++);
  disposeResources(a.root);
  assert.equal(texturesDisposed, 1); assert.equal(materialsDisposed, 1); assert.equal(otherDisposed, 0);
  disposeResources(b.root); assert.equal(otherDisposed, 1);
});

test('custom meshes without UVs receive finite projected UVs and normals without modifying cached geometry', async () => {
  const source = new THREE.BoxGeometry(10, 20, 5); source.deleteAttribute('uv'); source.deleteAttribute('normal');
  const position = source.getAttribute('position').array.slice();
  let calls = 0, disposed = 0; source.addEventListener('dispose', () => disposed++);
  const library = new ModelLibrary('https://example.com/', async () => { calls++; return [source]; });
  const model = { url: 'model.glb', rotation: [0, 90, 0] as [number, number, number] };
  const [wire, textured] = await Promise.all([library.create(model, '#61d8ee'), library.create(model, '#61d8ee', 'textured')]);
  assert.equal(calls, 1);
  assert.equal(source.hasAttribute('uv'), false); assert.equal(source.hasAttribute('normal'), false);
  assert.deepEqual(source.getAttribute('position').array, position);
  const mesh = surfaces(textured)[0];
  assert.ok([...mesh.geometry.getAttribute('uv').array].every(Number.isFinite));
  assert.ok([...mesh.geometry.getAttribute('normal').array].every(Number.isFinite));
  const a = new THREE.Box3().setFromObject(wire), b = new THREE.Box3().setFromObject(textured);
  assert.ok(a.min.distanceTo(b.min) < 1e-6 && a.max.distanceTo(b.max) < 1e-6);
  highlightModel(textured, true); assert.equal(mesh.material.emissiveIntensity, 0.24);
  disposeResources(textured); disposeResources(wire); assert.equal(disposed, 0);
  library.dispose(); assert.equal(disposed, 1);
});

test('textured custom types and unknown-type fallbacks keep the selected theme; supplied UVs are preserved', () => {
  const type = { id: 'example', name: 'Example', symbol: '◇', description: '', shape: 'product' as const };
  for (const id of ['example', 'unknown']) {
    const visual = createObjectVisual(id, '#ffffff', [type], 'textured');
    assert.ok(surfaces(visual.root).length); disposeResources(visual.root);
  }
  const source = new THREE.BoxGeometry(), original = source.getAttribute('uv').array.slice();
  const model = modelVisual([source], '#ffffff', [0, 0, 0], 'textured');
  assert.deepEqual(surfaces(model)[0].geometry.getAttribute('uv').array, original);
  assert.notEqual(surfaces(model)[0].geometry, source);
  disposeResources(model); source.dispose();
});
