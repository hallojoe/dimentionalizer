import * as THREE from 'three';
import { applyModelTheme, highlightModel } from './themes';
import type { ModelTheme } from './themes';
import { resolveType } from './catalog';
import type { ObjectType } from './catalog';
import type { CustomObjectType } from '../config/types';

export interface ObjectVisual {
  root: THREE.Group;
  hit: THREE.Mesh;
  highlight(active: boolean): void;
}
import { box, trace, wire } from './geometry-helpers';
import type { Builder, Point } from './geometry-helpers';
import { everydayBuilders } from './everyday';

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

const user: Builder = color => {
  const root = new THREE.Group();
  const head = wire(new THREE.SphereGeometry(0.45, 12, 8), color);
  head.position.y = 2.05;
  const body = wire(new THREE.CylinderGeometry(0.45, 0.8, 1.35, 10), color);
  body.position.y = 0.8;
  root.add(head, body);
  return root;
};
const usergroup: Builder = color => {
  const root = new THREE.Group();
  for (const [x, z, scale] of [[-1.15, 0.35, 0.78], [1.15, 0.35, 0.78], [0, -0.45, 1]]) {
    const person = user(color); person.scale.setScalar(scale); person.position.set(x, 0, z); root.add(person);
  }
  return root;
};
const event: Builder = color => {
  const root = new THREE.Group();
  box(root, color, [3, 2.15, 0.6], [0, 1.1, 0]);
  root.add(trace([[-1.5, 1.65, 0.32], [1.5, 1.65, 0.32]], color));
  for (const x of [-0.9, 0.9]) box(root, color, [0.16, 0.5, 0.2], [x, 2.15, 0]);
  for (const x of [-0.85, 0, 0.85]) for (const y of [0.55, 1.15]) box(root, color, [0.3, 0.3, 0.06], [x, y, 0.34]);
  return root;
};
const product: Builder = color => {
  const root = new THREE.Group();
  box(root, color, [2.4, 2.1, 2.2], [0, 1.05, 0]);
  root.add(trace([[0, 0, 1.11], [0, 2.11, 1.11], [0, 2.11, -1.1]], color));
  box(root, color, [0.75, 0.4, 0.04], [0.65, 0.55, 1.13]);
  return root;
};
const shop: Builder = color => {
  const root = new THREE.Group();
  box(root, color, [3.8, 1.75, 2], [0, 0.875, 0]);
  box(root, color, [4.2, 0.4, 1.2], [0, 2.05, 0.8]);
  for (let x = -1.9; x <= 1.9; x += 0.48) root.add(trace([[x, 2.25, 0.2], [x, 1.85, 1.4]], color));
  box(root, color, [0.8, 1.4, 0.06], [1.05, 0.7, 1.04]);
  box(root, color, [1.7, 0.85, 0.06], [-0.65, 1, 1.04]);
  return root;
};
const warehouse: Builder = color => {
  const root = new THREE.Group();
  box(root, color, [4.1, 1.7, 2.6], [0, 0.85, 0]);
  for (const z of [-1.3, 1.3]) root.add(trace([[-2.05, 1.7, z], [0, 2.55, z], [2.05, 1.7, z]], color));
  root.add(trace([[0, 2.55, -1.3], [0, 2.55, 1.3]], color));
  for (const x of [-1, 1]) {
    box(root, color, [1.45, 1.3, 0.05], [x, 0.65, 1.33]);
    for (const y of [0.4, 0.7, 1]) root.add(trace([[x - 0.7, y, 1.36], [x + 0.7, y, 1.36]], color, 0.5));
  }
  return root;
};
function arrow(root: THREE.Group, color: string, y: number, z: number, reverse = false): void {
  const sign = reverse ? -1 : 1;
  root.add(trace([[-1.9 * sign, y, z], [1.9 * sign, y, z], [1.25 * sign, y + 0.5, z]], color));
  root.add(trace([[1.9 * sign, y, z], [1.25 * sign, y - 0.5, z]], color));
}
const request: Builder = color => {
  const root = new THREE.Group(); box(root, color, [2.6, 1.8, 0.6], [0, 1.05, 0]); arrow(root, color, 1.1, 0.35); return root;
};
const response: Builder = color => {
  const root = new THREE.Group(); box(root, color, [2.6, 1.8, 0.6], [0, 1.05, 0]); arrow(root, color, 1.1, 0.35, true); return root;
};
const processing: Builder = color => {
  const root = new THREE.Group();
  const core = wire(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 12), color);
  core.rotation.x = Math.PI / 2; core.position.y = 1.3; root.add(core);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const tooth = wire(new THREE.BoxGeometry(0.48, 0.48, 0.6), color);
    tooth.position.set(Math.cos(angle), 1.3 + Math.sin(angle), 0); tooth.rotation.z = angle; root.add(tooth);
  }
  return root;
};
const workflow: Builder = color => {
  const root = new THREE.Group();
  for (const [x, y] of [[-1.5, 1.2], [1.3, 0.5], [1.3, 2]]) box(root, color, [0.85, 0.75, 0.85], [x, y, 0]);
  root.add(trace([[-1.05, 1.2, 0], [0, 1.2, 0], [0, 2, 0], [0.85, 2, 0]], color));
  root.add(trace([[0, 1.2, 0], [0, 0.5, 0], [0.85, 0.5, 0]], color));
  return root;
};
const webhook: Builder = color => {
  const root = new THREE.Group();
  for (const x of [-1.4, 1.4]) {
    const ring = wire(new THREE.TorusGeometry(0.55, 0.12, 6, 16), color); ring.position.set(x, 1.2, 0); root.add(ring);
  }
  root.add(trace([[-0.85, 1.2, 0], [0, 1.2, 0], [0, 2.2, 0], [1.4, 2.2, 0], [1.4, 1.85, 0]], color));
  root.add(trace([[1.05, 2.1, 0], [1.4, 1.75, 0], [1.75, 2.1, 0]], color));
  return root;
};
const apiCall: Builder = color => {
  const root = new THREE.Group();
  arrow(root, color, 1.8, 0); arrow(root, color, 0.7, 0, true);
  for (const x of [-2.1, 2.1]) box(root, color, [0.25, 2.5, 1], [x, 1.25, 0]);
  return root;
};
const dataflow: Builder = color => {
  const root = new THREE.Group();
  for (const z of [-0.8, 0, 0.8]) {
    arrow(root, color, 1.2, z);
    box(root, color, [0.4, 0.45, 0.4], [-0.8 + z, 1.2, z]);
  }
  return root;
};
const message: Builder = color => {
  const root = new THREE.Group(); box(root, color, [3.5, 1.7, 0.6], [0, 1.4, 0]);
  root.add(trace([[-1.2, 0.55, 0.3], [-1.2, 0.05, 0.3], [-0.5, 0.55, 0.3]], color));
  for (const x of [-0.8, 0, 0.8]) box(root, color, [0.15, 0.15, 0.05], [x, 1.4, 0.33]);
  return root;
};

/** Adding a catalog type requires a renderer here; TypeScript checks completeness. */
const builders: Record<ObjectType, Builder> = {
  ...everydayBuilders,
  container, database, email, cache, 'reverse-proxy': proxy, queue, storage, cdn,
  user, usergroup, event, product, shop, warehouse, workflow, request, response, processing, webhook, 'api-call': apiCall, dataflow, message,
};

export function createObjectVisual(type: string | undefined, color: string, customTypes: readonly CustomObjectType[] = [], theme: ModelTheme = 'wire'): ObjectVisual {
  const root = builders[resolveType(type, customTypes).shape](color);
  applyModelTheme(root, theme, color);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.6, 2.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.3;
  root.add(hit);
  return {
    root, hit,
    highlight(active) {
      highlightModel(root, active);
    },
  };
}
