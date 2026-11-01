import * as THREE from 'three';

/** Dispose shared resources once, including textures owned by imported models. */
export function disposeResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const bitmaps = new Set<ImageBitmap>();
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    }
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) {
    if (typeof ImageBitmap !== 'undefined' && texture.source.data instanceof ImageBitmap) bitmaps.add(texture.source.data);
    texture.dispose();
  }
  bitmaps.forEach(bitmap => bitmap.close());
  geometries.forEach(geometry => geometry.dispose());
}
