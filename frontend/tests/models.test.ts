import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { extractModelGeometry, inspectModelDocument, loadModelAsset, MAX_MODEL_BYTES, ModelLibrary, modelVisual, readModelResponse } from '../src/catalog/models';
import type { ModelAsset } from '../src/catalog/models';
import { createObjectVisual } from '../src/catalog/geometry';
import { disposeResources } from '../src/scene/resources';

const source = readFileSync(new URL('../public/models/parcel-locker.gltf', import.meta.url), 'utf8');
const bytes = (text: string) => new TextEncoder().encode(text).buffer;
function asGlb(text: string): ArrayBuffer {
  const document = JSON.parse(text);
  const binary = Buffer.from(document.buffers[0].uri.split(',')[1], 'base64');
  delete document.buffers[0].uri;
  const encoded = new TextEncoder().encode(JSON.stringify(document));
  const json = new Uint8Array(Math.ceil(encoded.length / 4) * 4); json.fill(32); json.set(encoded);
  const binLength = Math.ceil(binary.length / 4) * 4;
  const data = new ArrayBuffer(28 + json.length + binLength), view = new DataView(data);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, data.byteLength, true);
  view.setUint32(12, json.length, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(data, 20, json.length).set(json);
  view.setUint32(20 + json.length, binLength, true); view.setUint32(24 + json.length, 0x004e4942, true);
  new Uint8Array(data, 28 + json.length).set(binary);
  return data;
}

test('glTF and GLB load through the actual Three.js parser and normalize the bundled custom model', async () => {
  // FileLoader uses the browser ProgressEvent API, absent in Node's fetch implementation.
  const oldProgress = Object.getOwnPropertyDescriptor(globalThis, 'ProgressEvent');
  Object.defineProperty(globalThis, 'ProgressEvent', { configurable: true, value: class extends Event { constructor(type: string) { super(type); } } });
  const originalFetch = globalThis.fetch;
  try {
    for (const data of [bytes(source), asGlb(source)]) {
      globalThis.fetch = async (url, options) => String(url) === 'https://example.com/model' ? new Response(data) : originalFetch(url, options);
      const asset = await loadModelAsset('https://example.com/model', new AbortController().signal);
      assert.equal(asset.length, 7);
      const visual = modelVisual(asset, '#61d8ee', [0, 90, 0]);
      const box = new THREE.Box3().setFromObject(visual), size = box.getSize(new THREE.Vector3());
      assert.ok(Math.abs(box.min.y) < 1e-7);
      assert.ok(size.x <= 4.600001 && size.y <= 2.500001 && size.z <= 2.500001);
      assert.ok(Math.abs(box.min.x + box.max.x) < 1e-7);
      disposeResources(visual); asset.forEach(part => part.dispose());
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (oldProgress) Object.defineProperty(globalThis, 'ProgressEvent', oldProgress);
    else Reflect.deleteProperty(globalThis, 'ProgressEvent');
  }
});

test('model preflight rejects sidecars, incompatible formats, rigs, and required decoder extensions', () => {
  assert.doesNotThrow(() => inspectModelDocument(bytes(source)));
  for (const patch of [{ asset: { version: '1.0' } }, { buffers: [{ byteLength: 4, uri: 'sidecar.bin' }] },
    { images: [{ uri: 'https://example.com/texture.png' }] }, { skins: [{}] }, { extensionsRequired: ['KHR_draco_mesh_compression'] },
    { buffers: [{ byteLength: MAX_MODEL_BYTES + 1 }] }]) {
    assert.throws(() => inspectModelDocument(bytes(JSON.stringify({ ...JSON.parse(source), ...patch }))));
  }
  const broken = asGlb(source); new DataView(broken).setUint32(8, 1, true);
  assert.throws(() => inspectModelDocument(broken), /header/);
});

test('download errors and oversize streaming responses are rejected', async () => {
  await assert.rejects(readModelResponse(new Response('', { status: 404 })), /404/);
  await assert.rejects(readModelResponse(new Response('x', { headers: { 'content-length': String(MAX_MODEL_BYTES + 1) } })), /20 MB/);
  await assert.rejects(readModelResponse(new Response(new Uint8Array(MAX_MODEL_BYTES + 1))), /20 MB/);
});

test('static extraction bakes nested transforms without changing the source geometry', () => {
  const source = new THREE.BoxGeometry(1, 1, 1), original = new Float32Array(source.getAttribute('position').array);
  const parent = new THREE.Group(); parent.position.set(5, 10, -3);
  const mesh = new THREE.Mesh(source); mesh.scale.set(2, 3, 4); parent.add(mesh);
  const asset = extractModelGeometry(parent);
  asset[0].computeBoundingBox();
  assert.deepEqual(asset[0].boundingBox!.getSize(new THREE.Vector3()).toArray(), [2, 3, 4]);
  assert.deepEqual(asset[0].boundingBox!.getCenter(new THREE.Vector3()).toArray(), [5, 10, -3]);
  assert.deepEqual(source.getAttribute('position').array, original);
  disposeResources(parent); asset.forEach(part => part.dispose());
});

test('model library caches parsing and builds independently disposable appearances', async () => {
  let calls = 0, disposed = 0;
  const geometry = new THREE.BoxGeometry(); geometry.addEventListener('dispose', () => disposed++);
  const library = new ModelLibrary('https://example.com/explorer/', async url => {
    assert.equal(url, 'https://example.com/explorer/models/a.glb'); calls++; return [geometry];
  });
  const model = { url: 'models/a.glb', rotation: [0, 0, 0] as [number, number, number] };
  const [a, b] = await Promise.all([library.create(model, '#ff0000'), library.create(model, '#00ff00')]);
  assert.equal(calls, 1);
  assert.notEqual(a.children[0].children[0], b.children[0].children[0]);
  disposeResources(a); assert.equal(disposed, 0);
  disposeResources(b); library.dispose(); assert.equal(disposed, 1);
  library.dispose(); assert.equal(disposed, 1);
});

test('scene cancellation disposes late results and prevents obsolete models from attaching', async () => {
  let finish!: (asset: ModelAsset) => void;
  let signal!: AbortSignal;
  const library = new ModelLibrary('https://example.com/', async (_url, abort) => { signal = abort; return new Promise(resolve => { finish = resolve; }); });
  const pending = library.create({ url: 'a.glb', rotation: [0, 0, 0] }, '#ffffff');
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  library.dispose(); assert.equal(signal.aborted, true);
  let disposed = 0;
  const geometry = new THREE.BoxGeometry(); geometry.addEventListener('dispose', () => disposed++);
  finish([geometry]); await rejected; assert.equal(disposed, 1);
});

test('failed model loading retains a usable configured fallback shape', async () => {
  const type = { id: 'custom', name: 'Custom', symbol: '◇', description: '', shape: 'product' as const, model: { url: 'a.glb', rotation: [0, 0, 0] as [number, number, number] } };
  const visual = createObjectVisual('custom', '#ffffff', [type]);
  const library = new ModelLibrary('https://example.com/', async () => { throw Error('Unavailable'); });
  await assert.rejects(library.create(type.model, '#ffffff'), /Unavailable/);
  assert.ok(visual.root.children.includes(visual.hit));
  assert.ok(visual.root.children.length > 1);
  assert.ok(new THREE.Box3().setFromObject(visual.root).max.y <= 2.7);
  disposeResources(visual.root); library.dispose();
});
