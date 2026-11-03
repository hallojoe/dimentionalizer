import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createObjectVisual } from '../catalog/geometry';
import { resolveType } from '../catalog/catalog';
import { ModelLibrary } from '../catalog/models';
import { disposeResources } from './resources';
import type { ObjectVisual } from '../catalog/geometry';
import type { ArchitectureConfig, ConnectionEndpoint, EntityRef } from '../config/types';
import { endpointKey, endpointSpace } from '../config/connections';
import { sceneVisibility } from '../config/visibility';
import { viewDefaults } from '../config/defaults';
import { resolveFlow } from '../config/flow';
import { createFlowVisual, flowFrame } from './flow';
import type { ConnectionFlow } from '../config/types';
import { capacityMaximum, capacityRadius, connectorPath, connectionAnchor } from './connections';
import { layoutGroups, groupViewBounds, planeViewBounds, spaceViewBounds } from './layout';
import type { PlacedGroup, PlacedPlane, PlacedSpace } from './layout';

interface RenderedObject extends ObjectVisual { id: string; group: string; position: THREE.Vector3; label: HTMLButtonElement }
interface Packet { visual: ReturnType<typeof createFlowVisual>; path: THREE.Curve<THREE.Vector3>; reverse: boolean; enabled: boolean; offset: number; born: number; settings: ConnectionFlow; spaces: string[]; from: ConnectionEndpoint; to: ConnectionEndpoint }
export interface SceneViewer {
  setConfig(config: ArchitectureConfig, preserveCamera?: boolean): void;
  focusObject(id: string): void;
  focusSpace(id: string | null): void;
  setSpaceView(visible: string[], active: string | null): void;
  focusGroup(id: string | null): void;
  focusPlane(id: string): void;
  setVisible(ids: Set<string>): void;
  setOptions(options: ArchitectureConfig['view']): void;
  dispose(): void;
}

/** Owns GPU resources and camera only. No document persistence or inspector markup. */
export function createViewer(host: HTMLElement, onSelect: (id: string) => void, onScopeSelect?: (ref: EntityRef) => void, onModelError?: (type: string, message: string) => void): SceneViewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D architecture. Use the object directory for keyboard navigation.');
  host.append(renderer.domElement);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'scene-labels';
  host.append(labelLayer);
  const scene = new THREE.Scene();
  // Only solid model materials respond to these lights; wire geometry stays unchanged.
  scene.add(new THREE.HemisphereLight('#e9f5ff', '#26313b', 2));
  const keyLight = new THREE.DirectionalLight('#fff0dc', 3);
  keyLight.position.set(30, 60, 40); scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight('#9bcfff', 1.2);
  fillLight.position.set(-40, 20, -30); scene.add(fillLight);
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
  let planes: PlacedPlane[] = [];
  let spaces: PlacedSpace[] = [];
  let configState: ArchitectureConfig;
  let visibleSpaces = new Set<string>(), activeSpace: string | null = null;
  let visibleObjects = new Set<string>(), requestedObjects = new Set<string>(), visibleFrames = new Set<string>();
  const materialAppearance = new WeakMap<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
  function addToSpace(space: string, ...entries: THREE.Object3D[]): void {
    entries.forEach(entry => { entry.userData.space = space; root.add(entry); });
  }
  function addFrame(space: string, ref: EntityRef, ...entries: THREE.Object3D[]): void {
    entries.forEach(entry => { entry.userData.frameKey = endpointKey(ref); });
    addToSpace(space, ...entries);
  }
  function dimmed(space: string): boolean { return activeSpace !== null && activeSpace !== space; }
  function applySpaceAppearance(): void {
    for (const entry of root.children) {
      if (entry.userData.flow) continue; // Flow opacity composes lifecycle fading with space dimming each frame.
      const space = entry.userData.space as string | undefined;
      const endpoints = entry.userData.endpoints as string[] | undefined;
      if (space) entry.visible = visibleSpaces.has(space)
        && (!entry.userData.objectId || visibleObjects.has(entry.userData.objectId))
        && (!entry.userData.frameKey || visibleFrames.has(entry.userData.frameKey));
      const dim = space ? dimmed(space) : endpoints?.some(dimmed) ?? false;
      entry.traverse(child => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points)) return;
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          if (!materialAppearance.has(material)) materialAppearance.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
          const original = materialAppearance.get(material)!;
          const transparent = original.transparent || dim;
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
          material.opacity = original.opacity * (dim ? 0.12 : 1);
          material.depthWrite = original.depthWrite && !dim;
        }
      });
    }
  }
  let packets: Packet[] = [];
  let links: { line: THREE.Object3D; from: ConnectionEndpoint; to: ConnectionEndpoint }[] = [];
  let visibleEndpoints = new Set<string>();
  let groupLabels: { element: HTMLElement; position: THREE.Vector3; space: string; key: string }[] = [];
  let options = { ...viewDefaults };
  let selected = '', hovered = '', frame = 0;
  const home = new THREE.Vector3(30, 40, 50);
  const homeTarget = new THREE.Vector3();
  let flight: { start: number; from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3 } | null = null;

  let modelLibrary: ModelLibrary | undefined;
  let generation = 0;
  function fly(to: THREE.Vector3, targetTo: THREE.Vector3): void {
    flight = { start: performance.now(), from: camera.position.clone(), to, targetFrom: controls.target.clone(), targetTo };
  }
  const cancelFlight = () => { flight = null; };
  controls.addEventListener('start', cancelFlight);

  function setConfig(config: ArchitectureConfig, preserveCamera = false): void {
    configState = config; options = { ...config.view };
    visibleSpaces = new Set(config.spaceView.visible); activeSpace = config.spaceView.active;
    const currentGeneration = ++generation;
    modelLibrary?.dispose();
    modelLibrary = new ModelLibrary(new URL(import.meta.env.BASE_URL, location.href).href);
    const modelErrors = new Set<string>();
    disposeResources(root);
    root.clear();
    labelLayer.replaceChildren();
    objects = []; packets = []; links = []; groupLabels = [];
    selected = ''; hovered = '';
    renderer.setClearColor(config.presentation.background);
    scene.fog = new THREE.FogExp2(config.presentation.background, 0.003);
    const layout = layoutGroups(config);
    groups = layout.groups;
    planes = layout.planes; spaces = layout.spaces;
    if (spaces.length > 1) for (const space of spaces) {
      const corners = [[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([x,z]) => new THREE.Vector3(space.x + x * (space.width / 2 + 4), -0.12, space.z + z * (space.depth / 2 + 4)));
      addToSpace(space.id, new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners), new THREE.LineBasicMaterial({ color: config.presentation.accent, transparent: true, opacity: 0.25 })));
      const heading = document.createElement('button'); heading.className = 'platform-label space-label'; heading.textContent = space.name;
      heading.tabIndex = -1; heading.onclick = () => onScopeSelect?.({ kind: 'space', id: space.id }); labelLayer.append(heading);
      groupLabels.push({ element: heading, space: space.id, key: endpointKey({ kind: 'space', id: space.id }), position: new THREE.Vector3(space.x, 0, space.z - space.depth / 2 - 5) });
    }
    for (const plane of planes) {
      const { color, opacity, border, grid: showPlaneGrid, label } = plane.decoration;
      const surface = new THREE.Mesh(new THREE.PlaneGeometry(plane.width, plane.depth), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
      surface.rotation.x = -Math.PI / 2;
      surface.position.set(plane.x, plane.y - 0.04, plane.z);
      addFrame(plane.space, { kind: 'plane', id: plane.id }, surface);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => new THREE.Vector3(plane.x + x * plane.width / 2, plane.y - 0.03, plane.z + z * plane.depth / 2));
      if (border) addFrame(plane.space, { kind: 'plane', id: plane.id }, new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })));
      if (showPlaneGrid) {
        const lines: THREE.Vector3[] = [];
        const nx = Math.min(80, Math.ceil(plane.width / 2.5)), nz = Math.min(80, Math.ceil(plane.depth / 2.5));
        for (let i = 1; i < nx; i++) {
          const x = plane.x - plane.width / 2 + plane.width * i / nx;
          lines.push(new THREE.Vector3(x, plane.y - 0.02, plane.z - plane.depth / 2), new THREE.Vector3(x, plane.y - 0.02, plane.z + plane.depth / 2));
        }
        for (let i = 1; i < nz; i++) {
          const z = plane.z - plane.depth / 2 + plane.depth * i / nz;
          lines.push(new THREE.Vector3(plane.x - plane.width / 2, plane.y - 0.02, z), new THREE.Vector3(plane.x + plane.width / 2, plane.y - 0.02, z));
        }
        addFrame(plane.space, { kind: 'plane', id: plane.id }, new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false })));
      }
      if (label) {
        const heading = document.createElement('button');
        heading.className = 'platform-label plane-label'; heading.style.color = color;
        heading.textContent = `${plane.name.toUpperCase()} / PLANE`;
        heading.tabIndex = -1; heading.onclick = () => onScopeSelect?.({ kind: 'plane', id: plane.id });
        labelLayer.append(heading);
        groupLabels.push({ element: heading, space: plane.space, key: endpointKey({ kind: 'plane', id: plane.id }), position: new THREE.Vector3(plane.x - plane.width / 2, plane.y + 0.1, plane.z - plane.depth / 2 - 1) });
      }
    }
    for (const group of groups) {
      const space = planes.find(plane => plane.id === group.plane)!.space;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(group.width, group.depth), new THREE.MeshBasicMaterial({ color: group.color, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(group.x, group.y, group.z);
      addFrame(space, { kind: 'group', id: group.id }, floor);
      const bounds = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => new THREE.Vector3(group.x + x * group.width / 2, group.y + 0.02, group.z + z * group.depth / 2));
      addFrame(space, { kind: 'group', id: group.id }, new THREE.Line(new THREE.BufferGeometry().setFromPoints(bounds), new THREE.LineBasicMaterial({ color: group.color, transparent: true, opacity: 0.5 })));
      const heading = document.createElement('button');
      heading.className = 'platform-label';
      heading.tabIndex = -1; heading.onclick = () => onScopeSelect?.({ kind: 'group', id: group.id });
      heading.textContent = group.name.toUpperCase();
      heading.style.color = group.color;
      labelLayer.append(heading);
      groupLabels.push({ element: heading, space, key: endpointKey({ kind: 'group', id: group.id }), position: new THREE.Vector3(group.x - group.width / 2, group.y + 0.1, group.z + group.depth / 2 + 1.2) });
      for (const entry of group.objects) {
        const visual = createObjectVisual(entry.object.type, group.color, config.objectTypes, config.view.modelTheme);
        const type = resolveType(entry.object.type, config.objectTypes);
        if (type.model) {
          void modelLibrary.create(type.model, group.color, config.view.modelTheme).then(model => {
            if (generation !== currentGeneration) { disposeResources(model); return; }
            // Keep the stable hit target, position, labels, and selection callbacks.
            const fallback = new THREE.Group();
            for (const child of [...visual.root.children]) if (child !== visual.hit) fallback.add(child);
            disposeResources(fallback);
            visual.root.add(model); applySpaceAppearance();
          }).catch(error => {
            if (generation !== currentGeneration || modelErrors.has(type.id)) return;
            modelErrors.add(type.id);
            onModelError?.(type.id, `${type.name}: ${(error as Error).message} Showing the ${type.shape} fallback.`);
          });
        }
        visual.root.position.set(entry.x, entry.y + 0.35, entry.z);
        visual.hit.userData.id = entry.object.id;
        visual.root.userData.objectId = entry.object.id;
        addToSpace(space, visual.root);
        const label = document.createElement('button');
        label.className = 'object-label';
        label.textContent = `${entry.object.name}${entry.object.linkedSpace ? ' ↳' : ''}`;
        label.title = entry.object.linkedSpace ? `Enter ${config.spaces.find(s => s.id === entry.object.linkedSpace)!.name} and inspect ${entry.object.name}` : `Inspect ${entry.object.name}`;
        label.style.setProperty('--group-color', group.color);
        label.onclick = () => onSelect(entry.object.id);
        // The permanent directory is the ordered keyboard equivalent of these moving labels.
        label.tabIndex = -1;
        labelLayer.append(label);
        objects.push({ ...visual, id: entry.object.id, group: group.id, position: new THREE.Vector3(entry.x, entry.y + 1.5, entry.z), label });
      }
    }
    config.connections.forEach((connection, index) => {
      const start = new THREE.Vector3(...connectionAnchor(layout, connection.from));
      const end = new THREE.Vector3(...connectionAnchor(layout, connection.to));
      const decorated = !!connection.capacity;
      const lanes = connection.direction === 'bidirectional' ? [false, true] : [false];
      for (const reverse of lanes) {
        const value = reverse ? connection.capacity?.in : connection.capacity?.out;
        const radius = capacityRadius(value, capacityMaximum(config.connections, connection.capacity?.unit ?? ''));
        const path = connectorPath(start, end, connection.style, decorated && lanes.length === 2 ? (reverse ? -0.2 : 0.2) : 0);
        // Undecorated bidirectional lanes share the same thin geometry.
        if (!reverse || decorated) {
          const line = new THREE.Mesh(new THREE.TubeGeometry(path, 64, radius, 5, false), new THREE.MeshBasicMaterial({ color: config.presentation.accent, transparent: true, opacity: decorated ? 0.45 : 0.25 }));
          line.userData.endpoints = [endpointSpace(config, connection.from), endpointSpace(config, connection.to)];
          root.add(line); links.push({ line, from: connection.from, to: connection.to });
        }
        const settings = resolveFlow(connection), type = resolveType(reverse ? settings.in : settings.out, config.objectTypes);
        const visual = createFlowVisual(type.id, config.presentation.accent, config.objectTypes, config.view.modelTheme);
        root.add(visual.root);
        if (type.model) {
          void modelLibrary!.create(type.model, config.presentation.accent, config.view.modelTheme).then(model => {
            if (generation !== currentGeneration) { disposeResources(model); return; }
            visual.setModel(model);
          }).catch(error => {
            if (generation !== currentGeneration || modelErrors.has(type.id)) return;
            modelErrors.add(type.id);
            onModelError?.(type.id, `${type.name}: ${(error as Error).message} Showing the ${type.shape} fallback.`);
          });
        }
        packets.push({ visual, path, settings, born: performance.now(), offset: (index % 8) * 0.18 + (reverse ? 0.8 : 0),
          spaces: [endpointSpace(config, connection.from), endpointSpace(config, connection.to)],
          from: connection.from, to: connection.to, reverse, enabled: value !== 0 });
      }
    });
    homeTarget.set(0, layout.centerY, 0);
    home.set(layout.size * 0.85, layout.centerY + layout.size * 0.95, layout.size * 1.2);
    controls.maxDistance = layout.size * 5;
    camera.far = Math.max(2000, layout.size * 10);
    camera.updateProjectionMatrix();
    if (!preserveCamera) {
      camera.position.copy(home);
      controls.target.copy(homeTarget);
    }
    flight = null;
    setOptions(config.view);
    setVisible(new Set(objects.map(object => object.id)));
  }

  function setOptions(value: ArchitectureConfig['view']): void {
    if (value.modelTheme !== options.modelTheme) {
      const ids = new Set(requestedObjects), selection = selected;
      setConfig({ ...configState, spaceView: { visible: [...visibleSpaces], active: activeSpace }, view: { ...value } }, true);
      setVisible(ids); selected = selection;
      return;
    }
    options = { ...value };
    controls.autoRotate = options.autoOrbit && !reducedMotion;
    grid.visible = options.showGrid;
    setVisible(requestedObjects);
  }
  function focusGroup(id: string | null): void {
    selected = '';
    const group = groups.find(g => g.id === id);
    if (!group) { focusSpace(activeSpace); return; }
    const { size, centerY } = groupViewBounds(group);
    fly(new THREE.Vector3(group.x + size * 0.85, centerY + size * 1.2, group.z + size * 1.35), new THREE.Vector3(group.x, centerY, group.z));
  }
  function focusObject(id: string): void {
    const object = objects.find(o => o.id === id);
    if (!object) return;
    selected = id;
    fly(object.position.clone().add(new THREE.Vector3(8, 7, 11)), object.position.clone());
  }
  function focusPlane(id: string): void {
    selected = '';
    const plane = planes.find(p => p.id === id);
    if (!plane) return;
    const { size, centerY } = planeViewBounds(plane);
    fly(new THREE.Vector3(plane.x + size * 0.85, centerY + size * 1.2, plane.z + size * 1.35), new THREE.Vector3(plane.x, centerY, plane.z));
  }
  function focusSpace(id: string | null): void {
    selected = '';
    const bounds = spaceViewBounds(spaces.filter(space => id ? space.id === id : visibleSpaces.has(space.id)));
    const target = new THREE.Vector3(bounds.x, bounds.centerY, bounds.z);
    fly(target.clone().add(new THREE.Vector3(bounds.size * 0.85, bounds.size * 0.95, bounds.size * 1.2)), target);
  }
  function setSpaceView(visible: string[], active: string | null): void {
    visibleSpaces = new Set(visible); activeSpace = active;
    setVisible(requestedObjects);
  }
  function setVisible(ids: Set<string>): void {
    requestedObjects = new Set(ids);
    const visibility = sceneVisibility(configState, requestedObjects, [...visibleSpaces], options);
    visibleObjects = visibility.objects;
    visibleEndpoints = visibility.endpoints;
    visibleFrames = visibility.frames;
    links.forEach(link => { link.line.visible = visibleEndpoints.has(endpointKey(link.from)) && visibleEndpoints.has(endpointKey(link.to)); });
    applySpaceAppearance();
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
    for (const object of objects) {
      const active = object.id === selected || object.id === hovered;
      object.highlight(active);
      object.label.classList.toggle('selected', active);
      object.label.style.opacity = dimmed(object.root.userData.space) ? '0.12' : '1';
      positionLabel(object.label, object.position.clone().add(new THREE.Vector3(0, 1.9, 0)), options.showNames && object.root.visible);
    }
    groupLabels.forEach(label => { label.element.style.opacity = dimmed(label.space) ? '0.12' : '1'; positionLabel(label.element, label.position, visibleFrames.has(label.key)); });
    packets.forEach(packet => {
      const state = flowFrame((now - packet.born) / 1000 - packet.offset, packet.settings, packet.reverse, reducedMotion);
      const model = packet.visual.root;
      model.visible = packet.enabled && options.effects && state.presence > 0
        && visibleEndpoints.has(endpointKey(packet.from)) && visibleEndpoints.has(endpointKey(packet.to));
      if (!model.visible) return;
      model.position.copy(packet.path.getPointAt(state.progress));
      model.quaternion.copy(camera.quaternion); // Keep symbols readable without tumbling along curves.
      packet.visual.appearance(state.presence, packet.settings.size, packet.spaces.some(dimmed));
    });
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(render);
  return {
    setConfig, focusGroup, focusObject, focusPlane, focusSpace, setSpaceView, setVisible, setOptions,
    dispose() {
      generation++; modelLibrary?.dispose();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeResources(root); disposeResources(grid);
      renderer.dispose();
      renderer.domElement.remove(); labelLayer.remove();
    },
  };
}
