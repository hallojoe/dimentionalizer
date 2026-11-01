import * as THREE from 'three';
import { resolveType } from './catalog';
import type { ObjectType } from './catalog';

export interface ObjectVisual {
  root: THREE.Group;
  hit: THREE.Mesh;
  highlight(active: boolean): void;
}
type Builder = (color: string) => THREE.Group;
type Point = [number, number, number];

function trace(points: Point[], color: string, opacity = 0.8): THREE.Line {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}

/** Wire edges and luminous samples retain the original explorer's point-field aesthetic. */
function wire(geometry: THREE.BufferGeometry, color: string): THREE.Group {
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
  geometry.dispose();
  return root;
}
function box(root: THREE.Group, color: string, size: Point, position: Point): void {
  const part = wire(new THREE.BoxGeometry(...size), color);
  part.position.set(...position);
  root.add(part);
}

const container: Builder = color => {
  const root = new THREE.Group();
  box(root, color, [4.7, 2.1, 2], [0, 1.05, 0]);
  for (let x = -2.1; x < 2.2; x += 0.3) {
    root.add(trace([[x, 0.13, -1], [x, 1.97, -1], [x, 1.97, 1], [x, 0.13, 1]], color, 0.4));
  }
  for (const x of [-2.35, 2.35]) root.add(trace([[x, 0.1, 0], [x, 2, 0]], color));
  return root;
};
const database: Builder = color => {
  const root = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const disk = wire(new THREE.CylinderGeometry(1.45, 1.45, 0.62, 32), color);
    disk.position.y = 0.35 + i * 0.75;
    root.add(disk);
  }
  return root;
};
const email: Builder = color => {
  const root = new THREE.Group();
  box(root, color, [3.8, 2.3, 0.7], [0, 1.15, 0]);
  for (const z of [-0.36, 0.36]) {
    root.add(trace([[-1.9, 2.3, z], [0, 0.9, z], [1.9, 2.3, z]], color));
    root.add(trace([[-1.9, 0, z], [-0.5, 1.25, z]], color));
    root.add(trace([[1.9, 0, z], [0.5, 1.25, z]], color));
  }
  return root;
};
const cache: Builder = color => {
  const root = new THREE.Group();
  box(root, color, [3.6, 2, 1.8], [0, 1, 0]);
  root.add(trace([[0.4, 1.9, 0.92], [-0.7, 0.85, 0.92], [0.3, 0.85, 0.92], [-0.35, 0.05, 0.92]], color));
  for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) root.add(trace([[x, 2, -0.5], [x, 2.3, -0.5]], color));
  return root;
};
const proxy: Builder = color => {
  const root = new THREE.Group();
  box(root, color, [0.8, 2.4, 2.3], [0, 1.2, 0]);
  root.add(trace([[-2.2, 1.2, 0], [-0.5, 1.2, 0], [1.8, 1.2, -1]], color));
  root.add(trace([[0.5, 1.2, 0], [1.8, 1.2, 1]], color));
  for (const z of [-1, 1]) root.add(trace([[1.3, 1.2, z - 0.3], [1.8, 1.2, z], [1.3, 1.2, z + 0.3]], color));
  return root;
};
const queue: Builder = color => {
  const root = new THREE.Group();
  for (const x of [-1.45, 0, 1.45]) box(root, color, [1.05, 1.5, 1.6], [x, 1, 0]);
  root.add(trace([[-2.2, 0.1, 1.1], [2.2, 0.1, 1.1], [1.8, 0.1, 0.8]], color));
  return root;
};
const storage: Builder = color => {
  const root = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    box(root, color, [3.4, 0.6, 2], [0, 0.35 + i * 0.8, 0]);
    root.add(trace([[-0.5, 0.35 + i * 0.8, 1.01], [0.5, 0.35 + i * 0.8, 1.01]], color));
  }
  return root;
};
const cdn: Builder = color => {
  const root = new THREE.Group();
  const centers: Point[] = [[0, 1.4, 0], [-1.6, 0.6, -0.8], [1.6, 0.6, -0.8], [0, 0.6, 1.2]];
  centers.forEach((position, i) => {
    const node = wire(new THREE.OctahedronGeometry(i ? 0.5 : 0.8), color);
    node.position.set(...position);
    root.add(node);
    if (i) root.add(trace([centers[0], position], color));
  });
  return root;
};

/** Adding a catalog type requires a renderer here; TypeScript checks completeness. */
const builders: Record<ObjectType, Builder> = {
  container, database, email, cache, 'reverse-proxy': proxy, queue, storage, cdn,
};

export function createObjectVisual(type: string | undefined, color: string): ObjectVisual {
  const root = builders[resolveType(type).id](color);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.6, 2.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.3;
  root.add(hit);
  return {
    root, hit,
    highlight(active) {
      root.traverse(object => {
        if (object instanceof THREE.Points) object.material.size = active ? 0.105 : 0.055;
      });
    },
  };
}
