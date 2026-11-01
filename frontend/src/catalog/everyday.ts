import * as THREE from 'three';
import { box, trace, wire } from './geometry-helpers';
import type { Builder } from './geometry-helpers';

const adult: Builder = color => {
  const root = new THREE.Group();
  const head = wire(new THREE.SphereGeometry(0.33, 10, 8), color); head.position.y = 2.15; root.add(head);
  box(root, color, [0.75, 0.9, 0.45], [0, 1.35, 0]);
  for (const x of [-0.22, 0.22]) box(root, color, [0.25, 0.85, 0.35], [x, 0.45, 0]);
  for (const x of [-0.52, 0.52]) box(root, color, [0.22, 0.9, 0.3], [x, 1.25, 0]);
  return root;
};
const child: Builder = color => { const root = new THREE.Group(), person = adult(color); person.scale.setScalar(0.68); root.add(person); return root; };
const family: Builder = color => {
  const root = new THREE.Group();
  for (const [x, scale, z] of [[-1.15, 0.9, -0.2], [1.15, 0.9, -0.2], [0, 0.58, 0.5]]) {
    const person = adult(color); person.position.set(x, 0, z); person.scale.setScalar(scale); root.add(person);
  }
  return root;
};
const food: Builder = color => {
  const root = new THREE.Group();
  const plate = wire(new THREE.CylinderGeometry(1.35, 1.1, 0.2, 20), color); plate.position.y = 0.15; root.add(plate);
  for (const [x, z] of [[-0.55, 0], [0.45, 0.4], [0.3, -0.5]]) {
    const fruit = wire(new THREE.SphereGeometry(0.45, 10, 8), color); fruit.position.set(x, 0.7, z); root.add(fruit);
    root.add(trace([[x, 1.1, z], [x + 0.1, 1.4, z]], color));
  }
  return root;
};
const bed: Builder = color => {
  const root = new THREE.Group(); box(root, color, [4.2, 0.55, 2.3], [0, 0.65, 0]);
  box(root, color, [0.2, 1.6, 2.4], [-2, 0.8, 0]);
  for (const z of [-0.55, 0.55]) box(root, color, [0.7, 0.25, 0.9], [-1.4, 1.05, z]);
  for (const x of [-1.8, 1.8]) for (const z of [-0.9, 0.9]) box(root, color, [0.2, 0.4, 0.2], [x, 0.2, z]);
  return root;
};
const shower: Builder = color => {
  const root = new THREE.Group(); box(root, color, [2, 2.4, 2], [0, 1.2, 0]);
  root.add(trace([[0, 0.2, -0.9], [0, 2.2, -0.9], [0, 2.2, 0.2]], color));
  const head = wire(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12), color); head.position.set(0, 2.1, 0.2); root.add(head);
  for (const x of [-0.25, 0, 0.25]) root.add(trace([[x, 1.9, 0.2], [x, 0.6, 0.2]], color, 0.4));
  return root;
};
const toilet: Builder = color => {
  const root = new THREE.Group(); box(root, color, [1.3, 1.5, 0.5], [0, 0.9, -0.7]);
  const bowl = wire(new THREE.CylinderGeometry(0.7, 0.35, 0.7, 16), color); bowl.position.set(0, 0.65, 0.25); bowl.scale.z = 1.2; root.add(bowl);
  box(root, color, [0.6, 0.5, 0.7], [0, 0.25, 0.15]);
  root.add(trace([[0.2, 1.6, -0.43], [0.5, 1.6, -0.43]], color));
  return root;
};
const sofa: Builder = color => {
  const root = new THREE.Group(); box(root, color, [3.7, 0.6, 1.6], [0, 0.6, 0]);
  box(root, color, [3.7, 1.1, 0.4], [0, 1.35, -0.7]);
  for (const x of [-1.95, 1.95]) box(root, color, [0.4, 1.1, 1.7], [x, 0.85, 0]);
  for (const x of [-0.6, 0.6]) root.add(trace([[x, 0.92, -0.5], [x, 0.92, 0.8]], color));
  return root;
};
const chair: Builder = color => {
  const root = new THREE.Group(); box(root, color, [1.6, 0.2, 1.5], [0, 1, 0]);
  box(root, color, [1.6, 1.15, 0.2], [0, 1.7, -0.65]);
  for (const x of [-0.65, 0.65]) for (const z of [-0.55, 0.55]) box(root, color, [0.15, 1, 0.15], [x, 0.5, z]);
  return root;
};
const desk: Builder = color => {
  const root = new THREE.Group(); box(root, color, [3.8, 0.2, 1.8], [0, 1.6, 0]);
  for (const x of [-1.65, 1.65]) for (const z of [-0.65, 0.65]) box(root, color, [0.2, 1.5, 0.2], [x, 0.75, z]);
  box(root, color, [1.1, 0.4, 1.5], [1.1, 1.25, 0]); return root;
};
const wall: Builder = color => {
  const root = new THREE.Group(); box(root, color, [4.4, 2.4, 0.3], [0, 1.2, 0]);
  for (const y of [0.6, 1.2, 1.8]) root.add(trace([[-2.2, y, 0.16], [2.2, y, 0.16]], color, 0.5));
  for (const x of [-1.1, 0, 1.1]) root.add(trace([[x, 0, 0.16], [x, 2.4, 0.16]], color, 0.5));
  return root;
};
const windowWall: Builder = color => {
  const root = new THREE.Group();
  for (const x of [-2.1, 0, 2.1]) box(root, color, [0.12, 2.4, 0.2], [x, 1.2, 0]);
  for (const y of [0.06, 1.2, 2.34]) box(root, color, [4.2, 0.12, 0.2], [0, y, 0]);
  root.add(trace([[-1.7, 0.3, 0.11], [-0.4, 0.9, 0.11]], color, 0.4)); return root;
};
function wheels(root: THREE.Group, color: string): void {
  for (const x of [-1.4, 1.4]) for (const z of [-0.88, 0.88]) {
    const wheel = wire(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 12), color); wheel.rotation.x = Math.PI / 2; wheel.position.set(x, 0.32, z); root.add(wheel);
  }
}
const bus: Builder = color => {
  const root = new THREE.Group(); box(root, color, [4.4, 1.5, 1.65], [0, 1.2, 0]); wheels(root, color);
  for (const x of [-1.5, -0.6, 0.3, 1.2]) box(root, color, [0.65, 0.65, 0.04], [x, 1.55, 0.85]);
  box(root, color, [0.04, 0.8, 1.35], [2.22, 1.5, 0]); return root;
};
const train: Builder = color => {
  const root = bus(color); box(root, color, [3.8, 0.25, 1.6], [0, 2.1, 0]);
  root.add(trace([[-0.5, 2.23, 0], [0, 2.6, 0], [0.5, 2.23, 0]], color));
  for (const z of [-1.1, 1.1]) root.add(trace([[-2.3, 0.02, z], [2.3, 0.02, z]], color)); return root;
};
const airplane: Builder = color => {
  const root = new THREE.Group();
  const body = wire(new THREE.CylinderGeometry(0.2, 0.35, 4.2, 12), color); body.rotation.z = -Math.PI / 2; body.position.y = 1.1; root.add(body);
  root.add(trace([[0.8, 1.1, 0], [-0.6, 1.1, 1.65], [-1.05, 1.1, 1.65], [-0.7, 1.1, 0], [-1.05, 1.1, -1.65], [-0.6, 1.1, -1.65], [0.8, 1.1, 0]], color));
  root.add(trace([[-1.4, 1.1, 0], [-2.1, 1.1, 0.9], [-2.1, 1.1, -0.9], [-1.4, 1.1, 0], [-2.1, 2.15, 0], [-2.1, 1.1, 0]], color)); return root;
};
const office: Builder = color => {
  const root = new THREE.Group(); box(root, color, [3, 2.4, 2], [0, 1.2, 0]);
  for (const x of [-1, 0, 1]) for (const y of [0.7, 1.7]) box(root, color, [0.55, 0.65, 0.04], [x, y, 1.03]); return root;
};
const home: Builder = color => {
  const root = new THREE.Group(); box(root, color, [3.2, 1.6, 2.2], [0, 0.8, 0]);
  for (const z of [-1.1, 1.1]) root.add(trace([[-1.8, 1.6, z], [0, 2.5, z], [1.8, 1.6, z]], color));
  root.add(trace([[0, 2.5, -1.1], [0, 2.5, 1.1]], color));
  box(root, color, [0.7, 1.2, 0.05], [0, 0.6, 1.14]);
  for (const x of [-1, 1]) box(root, color, [0.6, 0.6, 0.04], [x, 1, 1.14]); return root;
};

export const everydayBuilders = { human: adult, adult, child, family, food, bed, shower, toilet, sofa, chair, desk, wall, 'window-wall': windowWall, bus, train, airplane, office, home };
