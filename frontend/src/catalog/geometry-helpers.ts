import * as THREE from 'three';
import { surfaceGeometry } from './themes';

export type Builder = (color: string) => THREE.Group;
export type Point = [number, number, number];

export function trace(points: Point[], color: string, opacity = 0.8): THREE.Line {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}

/** Wire edges and luminous samples retain the original explorer's point-field aesthetic. */
export function wire(geometry: THREE.BufferGeometry, color: string): THREE.Group {
  const root = new THREE.Group();
  const edges = new THREE.EdgesGeometry(geometry, 20);
  const vertices = edges.getAttribute('position');
  const points: number[] = [];
  for (let i = 0; i < vertices.count; i += 2) {
    const a = new THREE.Vector3().fromBufferAttribute(vertices, i);
    const b = new THREE.Vector3().fromBufferAttribute(vertices, i + 1);
    const steps = Math.ceil(a.distanceTo(b) / 0.12);
    for (let j = 0; j <= steps; j++) points.push(...a.clone().lerp(b, j / Math.max(steps, 1)).toArray());
  }
  const cloud = new THREE.BufferGeometry();
  cloud.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  root.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })));
  root.add(new THREE.Points(cloud, new THREE.PointsMaterial({ color, size: 0.055, transparent: true, opacity: 0.9 })));
  root.add(surfaceGeometry(geometry));
  return root;
}
export function box(root: THREE.Group, color: string, size: Point, position: Point): void {
  const part = wire(new THREE.BoxGeometry(...size), color);
  part.position.set(...position);
  root.add(part);
}

