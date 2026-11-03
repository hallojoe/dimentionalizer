import * as THREE from 'three';
import { createObjectVisual } from '../catalog/geometry';
import type { CustomObjectType, ConnectionFlow } from '../config/types';
import type { ModelTheme } from '../catalog/themes';
import { disposeResources } from './resources';

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Arrival and the loop reset both happen at zero opacity and zero scale. */
export function flowFrame(elapsed: number, settings: Pick<ConnectionFlow, 'duration' | 'gap'>, reverse = false, reducedMotion = false) {
  if (reducedMotion) return { progress: reverse ? 0.65 : 0.35, presence: 1 };
  if (elapsed < 0) return { progress: reverse ? 1 : 0, presence: 0 };
  const cycle = elapsed % (settings.duration + settings.gap);
  const t = Math.min(cycle / settings.duration, 1);
  const progress = smooth(t);
  const presence = smooth(t / 0.16) * smooth((1 - t) / 0.16);
  return { progress: reverse ? 1 - progress : progress, presence };
}

/** A reusable, centered model. Only transforms and opacity change each animation frame. */
export function createFlowVisual(type: string, color: string, customTypes: readonly CustomObjectType[], theme: ModelTheme) {
  const root = new THREE.Group(); root.visible = false; root.userData.flow = true;
  let materials: { material: THREE.Material; opacity: number }[] = [];
  function setModel(model: THREE.Group): void {
    // Normalize the real appearance, excluding the ordinary object's pick box.
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(longest) || longest <= 0) { disposeResources(model); throw Error('Connection model has invalid bounds.'); }
    const normalized = new THREE.Group(); normalized.add(model);
    model.position.sub(bounds.getCenter(new THREE.Vector3()));
    normalized.scale.setScalar(1 / longest);
    const owned = new Set<THREE.Material>();
    normalized.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) owned.add(material);
      }
    });
    const next = [...owned].map(material => ({ material, opacity: material.opacity }));
    next.forEach(({ material }) => { material.transparent = true; material.depthWrite = false; material.needsUpdate = true; });
    disposeResources(root); root.clear(); root.add(normalized); materials = next;
  }
  const fallback = createObjectVisual(type, color, customTypes, theme);
  fallback.hit.removeFromParent(); disposeResources(fallback.hit);
  setModel(fallback.root);
  return {
    root, setModel,
    appearance(presence: number, size: number, dimmed: boolean): void {
      root.scale.setScalar(size * presence);
      materials.forEach(({ material, opacity }) => { material.opacity = opacity * presence * (dimmed ? 0.12 : 1); });
    },
  };
}
