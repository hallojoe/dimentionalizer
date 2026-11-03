import * as THREE from 'three';
import { disposeResources } from '../scene/resources';

/** Add future themes here; documents store stable IDs, not renderer parameters. */
export const modelThemes = [
  { id: 'wire', name: 'Wire', description: 'Original luminous outlines and points.' },
  { id: 'textured', name: 'Textured', description: 'Solid, softly lit surfaces with a fine-grain finish.' },
] as const;
export type ModelTheme = typeof modelThemes[number]['id'];
export function isModelTheme(value: unknown): value is ModelTheme {
  return modelThemes.some(theme => theme.id === value);
}

/** Deterministic, local texture: no image downloads, canvas, or shared GPU ownership. */
export function grainTexture(): THREE.DataTexture {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  let seed = 1701;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const weave = (x % 8 === 0 || y % 8 === 0) ? -16 : 0;
    const value = 210 + Math.floor((seed / 0x100000000 - 0.5) * 34) + weave;
    const offset = (y * size + x) * 4;
    pixels.set([value, value, value, 255], offset);
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.name = 'Dimentionalizer fine grain';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

/** Retain the original triangles until the chosen theme is applied. */
export function surfaceGeometry(geometry: THREE.BufferGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
  mesh.userData.modelSurface = true;
  return mesh;
}

/** Imported static meshes may have no UVs. Generate a per-face box projection. */
function prepareSurface(source: THREE.BufferGeometry): THREE.BufferGeometry {
  let geometry = source;
  if (!geometry.hasAttribute('uv')) {
    if (geometry.index) { geometry = source.toNonIndexed(); source.dispose(); }
    geometry.computeBoundingBox();
    const min = geometry.boundingBox!.min, size = geometry.boundingBox!.getSize(new THREE.Vector3());
    const positions = geometry.getAttribute('position'), uv = new Float32Array(positions.count * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
      normal.crossVectors(b.sub(a), c.sub(a));
      const axis = Math.abs(normal.x) > Math.abs(normal.y) && Math.abs(normal.x) > Math.abs(normal.z) ? 'x' : Math.abs(normal.y) > Math.abs(normal.z) ? 'y' : 'z';
      const u = axis === 'x' ? 'z' : 'x', v = axis === 'y' ? 'z' : 'y';
      for (let j = i; j < i + 3; j++) {
        a.fromBufferAttribute(positions, j);
        uv[j * 2] = (a[u] - min[u]) / Math.max(size[u], 1e-8);
        uv[j * 2 + 1] = (a[v] - min[v]) / Math.max(size[v], 1e-8);
      }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  return geometry;
}

/** One appearance per visual. Geometry and textures are owned by that visual. */
export function applyModelTheme(root: THREE.Group, theme: ModelTheme, color: string): void {
  const surfaces: THREE.Mesh[] = [], points: THREE.Points[] = [];
  root.traverse(object => {
    if (object instanceof THREE.Mesh && object.userData.modelSurface) surfaces.push(object);
    if (object instanceof THREE.Points) points.push(object);
  });
  if (theme === 'wire') {
    surfaces.forEach(surface => { surface.removeFromParent(); disposeResources(surface); });
    return;
  }
  const texture = grainTexture();
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.18),
    map: texture, bumpMap: texture, bumpScale: 0.025,
    roughness: 0.82, metalness: 0.08, side: THREE.DoubleSide,
    emissive: color, emissiveIntensity: 0.035,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  surfaces.forEach(surface => {
    (Array.isArray(surface.material) ? surface.material : [surface.material]).forEach(old => old.dispose());
    surface.geometry = prepareSurface(surface.geometry);
    surface.material = material;
  });
  points.forEach(cloud => { cloud.removeFromParent(); disposeResources(cloud); });
  root.traverse(object => {
    if (object instanceof THREE.LineSegments && object.material instanceof THREE.LineBasicMaterial) object.material.opacity = 0.28;
  });
  if (!surfaces.length) { material.dispose(); texture.dispose(); }
}

export function highlightModel(root: THREE.Group, active: boolean): void {
  root.traverse(object => {
    if (object instanceof THREE.Points && object.material instanceof THREE.PointsMaterial) object.material.size = active ? 0.105 : 0.055;
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.material.emissiveIntensity = active ? 0.24 : 0.035;
  });
}
