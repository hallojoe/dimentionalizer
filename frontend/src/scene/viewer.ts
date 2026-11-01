import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createObjectVisual } from '../catalog/geometry';
import type { ObjectVisual } from '../catalog/geometry';
import type { ArchitectureConfig } from '../config/types';
import { layoutGroups } from './layout';
import type { PlacedGroup } from './layout';

interface RenderedObject extends ObjectVisual { id: string; group: string; position: THREE.Vector3; label: HTMLButtonElement }
interface Packet { dot: THREE.Mesh; path: THREE.CatmullRomCurve3; offset: number; from: string; to: string }
export interface SceneViewer {
  setConfig(config: ArchitectureConfig): void;
  focusObject(id: string): void;
  focusGroup(id: string | null): void;
  setVisible(ids: Set<string>): void;
  setOptions(options: ArchitectureConfig['view']): void;
  dispose(): void;
}

/** Owns GPU resources and camera only. No document persistence or inspector markup. */
export function createViewer(host: HTMLElement, onSelect: (id: string) => void): SceneViewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D architecture. Use the object directory for keyboard navigation.');
  host.append(renderer.domElement);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'scene-labels';
  host.append(labelLayer);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 5;
  controls.autoRotateSpeed = 0.32;
  const root = new THREE.Group();
  scene.add(root);
  const grid = new THREE.GridHelper(500, 200, '#20363d', '#13252c');
  grid.position.y = -0.08;
  scene.add(grid);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let objects: RenderedObject[] = [];
  let groups: PlacedGroup[] = [];
  let packets: Packet[] = [];
  let links: { line: THREE.Line; from: string; to: string }[] = [];
  let groupLabels: { element: HTMLElement; position: THREE.Vector3 }[] = [];
  let options = { showNames: true, effects: true, autoOrbit: false };
  let selected = '', hovered = '', frame = 0;
  const home = new THREE.Vector3(30, 40, 50);
  let flight: { start: number; from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3 } | null = null;

  function disposeRoot(object: THREE.Object3D): void {
    object.traverse(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => material.dispose());
      }
    });
  }
  function fly(to: THREE.Vector3, targetTo: THREE.Vector3): void {
    flight = { start: performance.now(), from: camera.position.clone(), to, targetFrom: controls.target.clone(), targetTo };
  }
  const cancelFlight = () => { flight = null; };
  controls.addEventListener('start', cancelFlight);

  function setConfig(config: ArchitectureConfig): void {
    disposeRoot(root);
    root.clear();
    labelLayer.replaceChildren();
    objects = []; packets = []; links = []; groupLabels = [];
    selected = ''; hovered = '';
    renderer.setClearColor(config.presentation.background);
    scene.fog = new THREE.FogExp2(config.presentation.background, 0.003);
    const layout = layoutGroups(config);
    groups = layout.groups;
    for (const group of groups) {
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(group.width, group.depth), new THREE.MeshBasicMaterial({ color: group.color, transparent: true, opacity: 0.035, side: THREE.DoubleSide }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(group.x, 0, group.z);
      root.add(floor);
      const bounds = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => new THREE.Vector3(group.x + x * group.width / 2, 0.02, group.z + z * group.depth / 2));
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bounds), new THREE.LineBasicMaterial({ color: group.color, transparent: true, opacity: 0.5 })));
      const heading = document.createElement('span');
      heading.className = 'platform-label';
      heading.textContent = group.name.toUpperCase();
      heading.style.color = group.color;
      labelLayer.append(heading);
      groupLabels.push({ element: heading, position: new THREE.Vector3(group.x - group.width / 2, 0.1, group.z + group.depth / 2 + 1.2) });
      for (const entry of group.objects) {
        const visual = createObjectVisual(entry.object.type, group.color);
        visual.root.position.set(entry.x, 0.35, entry.z);
        visual.hit.userData.id = entry.object.id;
        root.add(visual.root);
        const label = document.createElement('button');
        label.className = 'object-label';
        label.textContent = entry.object.name;
        label.title = `Inspect ${entry.object.name}`;
        label.style.setProperty('--group-color', group.color);
        label.onclick = () => onSelect(entry.object.id);
        // The permanent directory is the ordered keyboard equivalent of these moving labels.
        label.tabIndex = -1;
        labelLayer.append(label);
        objects.push({ ...visual, id: entry.object.id, group: group.id, position: new THREE.Vector3(entry.x, 1.5, entry.z), label });
      }
    }
    const byId = new Map(objects.map(object => [object.id, object]));
    config.connections.forEach((connection, index) => {
      const from = byId.get(connection.from)!, to = byId.get(connection.to)!;
      const start = from.position.clone();
      const end = to.position.clone();
      const middle = start.clone().lerp(end, 0.5);
      middle.y += Math.min(start.distanceTo(end) * 0.13, 5);
      const path = new THREE.CatmullRomCurve3([start, middle, end]);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(40)), new THREE.LineBasicMaterial({ color: config.presentation.accent, transparent: true, opacity: 0.18 }));
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: config.presentation.accent }));
      root.add(line, dot);
      links.push({ line, from: from.id, to: to.id });
      packets.push({ dot, path, offset: index * 0.13, from: from.id, to: to.id });
    });
    home.set(layout.size * 0.85, layout.size * 0.95, layout.size * 1.2);
    controls.maxDistance = layout.size * 5;
    camera.far = Math.max(2000, layout.size * 10);
    camera.updateProjectionMatrix();
    camera.position.copy(home);
    controls.target.set(0, 0, 0);
    flight = null;
    setOptions(config.view);
  }

  function setOptions(value: ArchitectureConfig['view']): void {
    options = { ...value };
    controls.autoRotate = options.autoOrbit && !reducedMotion;
  }
  function focusGroup(id: string | null): void {
    selected = '';
    const group = groups.find(g => g.id === id);
    if (!group) { fly(home.clone(), new THREE.Vector3()); return; }
    const size = Math.max(group.width, group.depth);
    fly(new THREE.Vector3(group.x + size * 0.85, size * 1.2, group.z + size * 1.35), new THREE.Vector3(group.x, 0, group.z));
  }
  function focusObject(id: string): void {
    const object = objects.find(o => o.id === id);
    if (!object) return;
    selected = id;
    fly(object.position.clone().add(new THREE.Vector3(8, 7, 11)), object.position.clone());
  }
  function setVisible(ids: Set<string>): void {
    objects.forEach(object => { object.root.visible = ids.has(object.id); });
    links.forEach(link => { link.line.visible = ids.has(link.from) && ids.has(link.to); });
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function pick(event: PointerEvent): string {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(objects.filter(o => o.root.visible).map(o => o.hit), false)[0]?.object.userData.id ?? '';
  }
  let down: [number, number] | undefined;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) { const id = pick(e); if (id) onSelect(id); }
    down = undefined;
  });
  renderer.domElement.addEventListener('pointercancel', () => { down = undefined; });
  renderer.domElement.addEventListener('pointermove', e => { hovered = pick(e); renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab'; });
  renderer.domElement.addEventListener('pointerleave', () => { hovered = ''; });
  function resize(): void {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(Math.max(width, 1), Math.max(height, 1));
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const projected = new THREE.Vector3();
  function positionLabel(element: HTMLElement, position: THREE.Vector3, visible: boolean): void {
    projected.copy(position).project(camera);
    element.hidden = !visible || projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1;
    if (!element.hidden) {
      element.style.left = `${(projected.x * 0.5 + 0.5) * host.clientWidth}px`;
      element.style.top = `${(-projected.y * 0.5 + 0.5) * host.clientHeight}px`;
    }
  }
  function render(now: number): void {
    frame = requestAnimationFrame(render);
    if (flight) {
      const t = Math.min((now - flight.start) / (reducedMotion ? 1 : 900), 1);
      const eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(flight.from, flight.to, eased);
      controls.target.lerpVectors(flight.targetFrom, flight.targetTo, eased);
      if (t === 1) flight = null;
    }
    controls.update();
    const visibleIds = new Set(objects.filter(o => o.root.visible).map(o => o.id));
    for (const object of objects) {
      const active = object.id === selected || object.id === hovered;
      object.highlight(active);
      object.label.classList.toggle('selected', active);
      positionLabel(object.label, object.position.clone().setY(3.4), options.showNames && object.root.visible);
    }
    groupLabels.forEach(label => positionLabel(label.element, label.position, true));
    packets.forEach(packet => {
      packet.dot.visible = options.effects && visibleIds.has(packet.from) && visibleIds.has(packet.to);
      packet.dot.position.copy(packet.path.getPoint(reducedMotion ? 0.5 : (now * 0.00008 + packet.offset) % 1));
    });
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(render);
  return {
    setConfig, focusGroup, focusObject, setVisible, setOptions,
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeRoot(root); disposeRoot(grid);
      renderer.dispose();
      renderer.domElement.remove(); labelLayer.remove();
    },
  };
}
