import * as THREE from 'three';
import type { CustomObjectType } from '../config/types';
import { resolveModelUrl } from '../config/model-url';
import { disposeResources } from '../scene/resources';

export const MAX_MODEL_BYTES = 20_000_000;
const MAX_VERTICES = 100_000;
export type ModelAsset = THREE.BufferGeometry[];
export type ModelLoader = (url: string, signal: AbortSignal) => Promise<ModelAsset>;

/** Accept portable, self-contained glTF 2.0 and GLB; never fetch sidecar assets. */
export function inspectModelDocument(data: ArrayBuffer): void {
  if (data.byteLength > MAX_MODEL_BYTES) throw Error('Model exceeds the 20 MB limit.');
  const view = new DataView(data);
  let json: string;
  if (data.byteLength >= 4 && view.getUint32(0, true) === 0x46546c67) {
    if (data.byteLength < 20 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== data.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw Error('Invalid glTF 2.0 GLB header.');
    const length = view.getUint32(12, true);
    if (length > data.byteLength - 20) throw Error('Invalid GLB JSON chunk.');
    json = new TextDecoder().decode(new Uint8Array(data, 20, length));
  } else json = new TextDecoder().decode(data);
  const document = JSON.parse(json);
  if (document?.asset?.version !== '2.0') throw Error('Use a glTF 2.0 model.');
  // Unknown required extensions must not silently produce a different model.
  const supported = new Set(['KHR_materials_unlit', 'KHR_mesh_quantization', 'KHR_texture_transform']);
  for (const extension of document.extensionsRequired ?? []) {
    if (!supported.has(extension)) throw Error(`Required model extension ${extension} is not supported. Export an uncompressed static mesh.`);
  }
  if ((document.nodes?.length ?? 0) > 1024 || (document.meshes?.length ?? 0) > 256) throw Error('Model contains too many nodes or meshes.');
  if (document.skins?.length) throw Error('Use a static mesh without a skin or rig.');
  let bytes = 0;
  for (const buffer of document.buffers ?? []) {
    if (!Number.isFinite(buffer.byteLength) || buffer.byteLength < 0) throw Error('Invalid model buffer size.');
    bytes += buffer.byteLength;
  }
  if (bytes > MAX_MODEL_BYTES) throw Error('Decoded model buffers exceed 20 MB.');
  for (const resource of [...(document.buffers ?? []), ...(document.images ?? [])]) {
    if (resource.uri !== undefined && (typeof resource.uri !== 'string' || !/^data:[^,]*;base64,/i.test(resource.uri))) {
      throw Error('Use a self-contained GLB or glTF with embedded buffers and images. External sidecar assets are not supported.');
    }
  }
}

export async function readModelResponse(response: Response): Promise<ArrayBuffer> {
  if (!response.ok) throw Error(`Model request failed (${response.status}).`);
  if (Number(response.headers.get('content-length')) > MAX_MODEL_BYTES) {
    await response.body?.cancel(); throw Error('Model exceeds the 20 MB limit.');
  }
  if (!response.body) throw Error('Model response is empty.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_MODEL_BYTES) { await reader.cancel(); throw Error('Model exceeds the 20 MB limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result.buffer;
}

/** Bake static node transforms into independent geometry; appearance comes from the group. */
export function extractModelGeometry(scene: THREE.Object3D): ModelAsset {
  const parts: ModelAsset = [];
  let vertices = 0;
  scene.updateMatrixWorld(true);
  try {
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh || Object.keys(object.geometry.morphAttributes).length) throw Error('Use a static mesh without skinning or morph targets.');
      const position = object.geometry.getAttribute('position');
      if (!position) return;
      const count = object instanceof THREE.InstancedMesh ? object.count : 1;
      vertices += position.count * count;
      if (vertices > MAX_VERTICES) throw Error('Model exceeds 100,000 vertices.');
      for (let i = 0; i < count; i++) {
        const transform = object.matrixWorld.clone();
        if (object instanceof THREE.InstancedMesh) {
          const instance = new THREE.Matrix4(); object.getMatrixAt(i, instance); transform.multiply(instance);
        }
        const geometry = object.geometry.clone().applyMatrix4(transform);
        parts.push(geometry);
      }
    });
    if (!parts.length) throw Error('Model has no triangle mesh geometry.');
    return parts;
  } catch (error) { parts.forEach(part => part.dispose()); throw error; }
}

export const loadModelAsset: ModelLoader = async (url, signal) => {
  const data = await readModelResponse(await fetch(url, { signal, credentials: 'omit' }));
  inspectModelDocument(data);
  signal.throwIfAborted();
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().parseAsync(data, '');
  try { signal.throwIfAborted(); return extractModelGeometry(gltf.scene); }
  finally {
    const scenes = new THREE.Group(); scenes.add(...gltf.scenes); disposeResources(scenes);
  }
};

/** Center X/Z, ground Y, preserve proportions, and fit the common object envelope. */
export function modelVisual(asset: ModelAsset, color: string, rotation: [number, number, number]): THREE.Group {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  try {
    for (const geometry of asset) {
      body.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 15), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })));
      const cloud = new THREE.BufferGeometry(); cloud.setAttribute('position', geometry.getAttribute('position').clone());
      body.add(new THREE.Points(cloud, new THREE.PointsMaterial({ color, size: 0.055, transparent: true, opacity: 0.8 })));
    }
    body.rotation.set(...rotation.map(THREE.MathUtils.degToRad) as [number, number, number]);
    body.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(body);
    const size = bounds.getSize(new THREE.Vector3());
    if (bounds.isEmpty() || ![...bounds.min, ...bounds.max].every(Number.isFinite) || Math.max(...size) < 1e-8) throw Error('Model geometry has empty or invalid bounds.');
    const scale = Math.min(4.6 / Math.max(size.x, 1e-8), 2.5 / Math.max(size.y, 1e-8), 2.5 / Math.max(size.z, 1e-8));
    const center = bounds.getCenter(new THREE.Vector3());
    body.scale.setScalar(scale); body.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return root;
  } catch (error) { disposeResources(root); throw error; }
}

/** One fetch/parse per asset per scene, with cancellation and late-result disposal. */
export class ModelLibrary {
  private controller = new AbortController();
  private pending = new Map<string, Promise<ModelAsset>>();
  private assets: ModelAsset[] = [];
  constructor(private base: string, private loader: ModelLoader = loadModelAsset) {}
  async create(model: NonNullable<CustomObjectType['model']>, color: string): Promise<THREE.Group> {
    this.controller.signal.throwIfAborted();
    const url = resolveModelUrl(model.url, this.base);
    let pending = this.pending.get(url);
    if (!pending) {
      const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(30_000)]);
      pending = this.loader(url, signal).then(asset => {
        if (this.controller.signal.aborted) { asset.forEach(part => part.dispose()); this.controller.signal.throwIfAborted(); }
        this.assets.push(asset); return asset;
      });
      this.pending.set(url, pending);
    }
    const asset = await pending;
    this.controller.signal.throwIfAborted();
    return modelVisual(asset, color, model.rotation);
  }
  dispose(): void {
    this.controller.abort();
    this.assets.flat().forEach(part => part.dispose()); this.assets = []; this.pending.clear();
  }
}
