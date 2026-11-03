import { getObjectCatalog, resolveType } from '../catalog/catalog';
import { parseConfig } from '../config/validate';
import { loadSaved, saveConfig } from '../config/storage';
import type { ArchitectureConfig, ArchitectureGroup, ArchitectureObject, ConnectionEndpoint, EntityRef, SpaceView } from '../config/types';
import { endpointKey, endpointName, endpointRef, endpointSpace } from '../config/connections';
import { layoutGroups } from '../scene/layout';
import { createViewer } from '../scene/viewer';
import type { SceneViewer } from '../scene/viewer';
import { element, get } from './dom';
import { shell } from './shell';
import { mountPresetPicker } from './presets';
import { elevationControl } from './elevation';
import { mountSpaces } from './spaces';
import { enterSpace } from '../config/spaces';
import { connectorControls } from './connectors';
import { spacingControls } from './spacing';
import { checklistControls } from './checklist';
import { planeControls } from './planes';
import { visibleEntities } from '../config/visibility';
import { visibilityControls } from './visibility';
import { modelThemes, isModelTheme } from '../catalog/themes';

export async function startApp(): Promise<() => void> {
  get('app').innerHTML = shell;
  const response = await fetch(`${import.meta.env.BASE_URL}architecture.json`);
  if (!response.ok) throw Error(`Could not load architecture.json (${response.status}).`);
  const defaults = parseConfig(await response.text()).config;
  const saved = loadSaved();
  let config = saved.config ?? structuredClone(defaults);
  let activeGroup: string | null = null;
  let activePlane: string | null = null;
  let selected: string | null = null;
  let selectedScope: EntityRef | null = null;
  let query = '', typeFilter = 'all';
  const spaceHistory: SpaceView[] = [];
  let viewer: SceneViewer | undefined;
  const modelErrors = new Map<string, string>();
  function clearModelErrors(): void { modelErrors.clear(); get('model-notice').hidden = true; }
  function reportModelError(type: string, message: string): void {
    modelErrors.set(type, message); get('model-notice').textContent = [...modelErrors.values()].join(' '); get('model-notice').hidden = false;
  }
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  const editor = get<HTMLTextAreaElement>('json-editor');
  const configDialog = get<HTMLDialogElement>('configuration');

  function notify(message: string): void {
    clearTimeout(noticeTimer);
    get('notice').textContent = message;
    get('notice').hidden = false;
    noticeTimer = setTimeout(() => { get('notice').hidden = true; }, 8000);
  }
  function persist(): void {
    if (!saveConfig(config)) notify('Changes are active, but browser storage is unavailable. Export your configuration to keep them.');
  }
  function spaceContains(space: string): boolean {
    return config.spaceView.visible.includes(space) && (!config.spaceView.active || config.spaceView.active === space);
  }
  function renderSpaceNavigation(): void {
    const select = get<HTMLSelectElement>('space-focus'); select.replaceChildren();
    const overview = element('option', '', 'Combined view'); overview.value = ''; select.append(overview);
    config.spaces.forEach(space => { const option = element('option', '', space.name); option.value = space.id; select.append(option); });
    select.value = config.spaceView.active ?? '';
    get<HTMLButtonElement>('space-back').disabled = !spaceHistory.length;
    get('space-context').textContent = config.spaceView.active
      ? `${config.spaces.find(s => s.id === config.spaceView.active)!.name} in focus · other visible spaces dimmed`
      : `${config.spaceView.visible.length} spaces in view`;
  }
  function changeSpaceView(view: SpaceView, remember = true, focus = true): void {
    if (remember && JSON.stringify(view) !== JSON.stringify(config.spaceView)) spaceHistory.push(structuredClone(config.spaceView));
    config.spaceView = view; activeGroup = null; activePlane = null; query = ''; typeFilter = 'all';
    get<HTMLInputElement>('search').value = ''; get<HTMLSelectElement>('type-filter').value = 'all';
    renderDirectory();
    if (focus) viewer?.focusSpace(view.active);
    persist();
  }
  function navigateSpace(id: string): void { changeSpaceView(enterSpace(config.spaceView, id)); }
  function refreshConfiguration(): void {
    clearModelErrors();
    viewer?.setConfig(config, true);
    renderDirectory();
    if (selected) inspect(selected, false);
    else if (selectedScope) inspectScope(selectedScope, false);
    else if (activeGroup) viewer?.focusGroup(activeGroup);
    else if (activePlane) viewer?.focusPlane(activePlane);
    else viewer?.focusGroup(null);
    persist();
  }
  function matches(object: ArchitectureObject): boolean {
    const type = resolveType(object.type, config.objectTypes);
    return spaceContains(endpointSpace(config, object.id)) && (!activeGroup || object.group === activeGroup)
      && (!activePlane || config.groups.find(group => group.id === object.group)?.plane === activePlane)
      && (typeFilter === 'all' || type.id === typeFilter)
      && `${object.name} ${object.description ?? ''} ${object.type ?? 'container'} ${type.name}`.toLowerCase().includes(query);
  }
  function renderDirectory(): void {
    renderSpaceNavigation();
    const shown = visibleEntities(config, config.spaces.map(space => space.id));
    const hiddenSuffix = (ref: EntityRef) => shown.has(endpointKey(ref)) ? '' : ' · Hidden';
    const planes = get<HTMLSelectElement>('plane-filter');
    planes.replaceChildren();
    const all = element('option', '', 'All planes'); all.value = ''; planes.append(all);
    config.planes.filter(plane => spaceContains(plane.space)).forEach(plane => {
      const option = element('option', '', plane.name + hiddenSuffix({ kind: 'plane', id: plane.id })); option.value = plane.id; planes.append(option);
    });
    planes.value = activePlane ?? '';
    get<HTMLButtonElement>('inspect-plane').disabled = !activePlane;
    const warnings = layoutGroups(config).warnings;
    get('layout-notice').textContent = warnings.join(' ');
    get('layout-notice').hidden = !warnings.length;
    const groups = get('groups');
    groups.replaceChildren();
    function groupButton(id: string | null, name: string, count: number, color: string): void {
      const button = element('button', `group-button${id === activeGroup ? ' active' : ''}`);
      button.setAttribute('aria-pressed', String(id === activeGroup));
      const dot = element('span', 'group-dot'); dot.style.background = color;
      button.append(dot, element('span', '', name), element('small', '', String(count).padStart(2, '0')));
      button.onclick = () => { activeGroup = id; closeInspector(); renderDirectory(); if (!id && activePlane) viewer?.focusPlane(activePlane); else viewer?.focusGroup(id); };
      groups.append(button);
    }
    groupButton(null, activePlane ? 'Entire plane' : 'Entire network', config.objects.filter(o => spaceContains(endpointSpace(config, o.id)) && (!activePlane || config.groups.find(g => g.id === o.group)?.plane === activePlane)).length, config.presentation.accent);
    config.groups.filter(group => spaceContains(endpointSpace(config, { kind: 'group', id: group.id })) && (!activePlane || group.plane === activePlane)).forEach(group => groupButton(group.id, group.name + hiddenSuffix({ kind: 'group', id: group.id }), config.objects.filter(o => o.group === group.id).length, group.color));
    const groupEditor = get('group-elevation-controls');
    groupEditor.replaceChildren();
    const currentGroup = config.groups.find(group => group.id === activeGroup);
    groupEditor.hidden = !currentGroup;
    if (currentGroup) groupEditor.append(elevationControl('group-elevation', 'Group elevation', currentGroup.elevation ?? 0, '0 = baseline · positive = above · negative = below', value => {
      currentGroup.elevation = value;
      refreshConfiguration();
    }));
    if (currentGroup) {
      const button = element('button', 'scope-button', 'Inspect group & connections ↗');
      button.onclick = () => inspectScope({ kind: 'group', id: currentGroup.id });
      groupEditor.append(button);
    }
    const objects = config.objects.filter(matches);
    const list = get('object-list');
    list.replaceChildren();
    objects.forEach(object => {
      const type = resolveType(object.type, config.objectTypes);
      const button = element('button', `object-row${object.id === selected ? ' selected' : ''}`);
      button.setAttribute('aria-label', object.linkedSpace ? `Enter ${config.spaces.find(s => s.id === object.linkedSpace)!.name} and inspect ${object.name}` : `Inspect ${object.name}, ${type.name}`);
      button.setAttribute('aria-pressed', String(object.id === selected));
      const symbol = element('span', 'object-symbol', type.symbol);
      symbol.style.color = config.groups.find(g => g.id === object.group)!.color;
      const text = element('span', 'object-row-text');
      text.append(element('span', '', object.name + hiddenSuffix({ kind: 'object', id: object.id })), element('small', '', object.linkedSpace ? `${type.name} · opens ${config.spaces.find(s => s.id === object.linkedSpace)!.name}` : type.name));
      button.append(symbol, text, element('span', 'row-arrow', '↗'));
      button.onclick = () => inspect(object.id);
      list.append(button);
    });
    if (!objects.length) list.append(element('p', 'empty-list', !config.objects.some(o => spaceContains(endpointSpace(config, o.id))) ? 'This space is empty. Add objects in Configure or create a space from a template.' : config.objects.length ? 'No objects match these filters.' : 'No objects yet. Add some in Configure.'));
    get('visible-count').textContent = `${objects.length} / ${config.objects.length}`;
    get('scene-context').textContent = (config.groups.find(g => g.id === activeGroup)?.name ?? config.planes.find(p => p.id === activePlane)?.name ?? config.spaces.find(s => s.id === config.spaceView.active)?.name ?? 'Combined view').toUpperCase();
    viewer?.setSpaceView(config.spaceView.visible, config.spaceView.active);
    const sceneObjects = config.objects.filter(object => {
      const space = endpointSpace(config, object.id);
      return config.spaceView.visible.includes(space) && (config.spaceView.active && config.spaceView.active !== space || matches(object));
    });
    viewer?.setVisible(new Set(sceneObjects.map(o => o.id)));
    renderFallback(objects.filter(object => shown.has(endpointKey(object.id))));
  }
  function renderFallback(objects: ArchitectureObject[]): void {
    const summary = get('fallback-summary');
    summary.replaceChildren();
    config.groups.forEach(group => {
      const entries = objects.filter(o => o.group === group.id);
      if (!entries.length) return;
      const section = element('section', 'fallback-group');
      section.style.setProperty('--group-color', group.color);
      section.append(element('h3', '', group.name));
      entries.forEach(object => {
        const button = element('button', '', `${resolveType(object.type, config.objectTypes).symbol}  ${object.name}`);
        button.onclick = () => inspect(object.id);
        section.append(button);
      });
      summary.append(section);
    });
  }
  function closeInspector(): void {
    selected = null;
    selectedScope = null;
    get('inspector').hidden = true;
    document.querySelector('.workspace')?.classList.remove('inspecting');
  }
  function inspect(id: string, moveFocus = true): void {
    const object = config.objects.find(o => o.id === id);
    if (!object) return;
    if (moveFocus && !object.linkedSpace) changeSpaceView(enterSpace(config.spaceView, endpointSpace(config, id)), true, false);
    // Connections can lead to an object outside the current group or search.
    if (!matches(object)) {
      activeGroup = null; activePlane = null; query = ''; typeFilter = 'all';
      get<HTMLInputElement>('search').value = '';
      get<HTMLSelectElement>('type-filter').value = 'all';
    }
    selected = id;
    selectedScope = null;
    get('inspector-label').textContent = 'OBJECT INSPECTOR';
    get('inspector-nav').hidden = false;
    const group = config.groups.find(g => g.id === object.group)!;
    const plane = config.planes.find(p => p.id === group.plane)!;
    const type = resolveType(object.type, config.objectTypes);
    const panel = get('inspector-content');
    panel.replaceChildren();
    const icon = element('div', 'inspector-icon', type.symbol); icon.style.color = group.color;
    panel.append(icon, element('div', 'eyebrow', type.name.toUpperCase()), element('h2', '', object.name), element('span', 'tag', group.name), element('p', 'object-description', object.description || 'No description provided.'));
    const metadata = element('dl', 'metadata');
    for (const [label, value] of [['Object ID', object.id], ['Type', object.type ?? 'container']]) metadata.append(element('dt', '', label), element('dd', '', value));
    panel.append(metadata, visibilityControls(config, { kind: 'object', id: object.id }, object, refreshConfiguration), checklistControls(object, persist));
    const typeLabel = element('label', 'property-field', 'Object type');
    const typeSelect = element('select'); typeSelect.setAttribute('aria-label', 'Object type');
    const availableTypes = getObjectCatalog(config.objectTypes);
    if (!availableTypes.some(entry => entry.id === object.type)) {
      const unknown = element('option', '', `${object.type} (Container fallback)`); unknown.value = object.type ?? 'container'; typeSelect.append(unknown);
    }
    for (const entry of availableTypes) { const option = element('option', '', `${entry.name}${entry.custom ? ' · custom' : ''}`); option.value = entry.id; typeSelect.append(option); }
    typeSelect.value = object.type ?? 'container';
    typeSelect.onchange = () => { object.type = typeSelect.value; refreshConfiguration(); };
    typeLabel.append(typeSelect); panel.append(typeLabel);
    if (type.custom) panel.append(element('p', 'muted', type.model ? `Custom model: ${type.model.url}` : `Custom type using the ${type.shape} shape.`));
    const portal = element('label', 'property-field', 'Open space when clicked'), target = element('select');
    const none = element('option', '', 'No linked space'); none.value = ''; target.append(none);
    config.spaces.filter(space => space.id !== plane.space).forEach(space => { const option = element('option', '', space.name); option.value = space.id; target.append(option); });
    target.value = object.linkedSpace ?? '';
    target.onchange = () => { if (target.value) object.linkedSpace = target.value; else delete object.linkedSpace; refreshConfiguration(); };
    portal.append(target); panel.append(portal);
    if (object.linkedSpace) { const open = element('button', 'scope-button', `Enter ${config.spaces.find(s => s.id === object.linkedSpace)!.name} ↗`); open.onclick = () => navigateSpace(object.linkedSpace!); panel.append(open); }
    const elevations = element('section', 'inspector-elevations');
    elevations.append(
      elevationControl('inspect-group-elevation', 'Group elevation', group.elevation ?? 0, 'Moves this group and its objects relative to the parent plane.', value => {
        group.elevation = value; refreshConfiguration();
      }),
      elevationControl('item-elevation', 'Item elevation', object.elevation ?? 0, 'Relative to its group: 10 above, −10 below.', value => {
        object.elevation = value; refreshConfiguration();
      }),
      element('p', 'muted', `World elevation: ${plane.elevation + (group.elevation ?? 0) + (object.elevation ?? 0)} (${plane.elevation} plane + ${group.elevation ?? 0} group + ${object.elevation ?? 0} item)`),
    );
    const parent = element('button', 'scope-button', `Plane: ${plane.name} ↗`);
    parent.onclick = () => inspectScope({ kind: 'plane', id: plane.id });
    elevations.prepend(parent);
    panel.append(elevations);
    panel.append(spacingControls(object, group, false, refreshConfiguration));
    renderConnections(panel, id);
    get('object-position').textContent = `${config.objects.indexOf(object) + 1} / ${config.objects.length}`;
    openInspector();
    renderDirectory();
    if (moveFocus && object.linkedSpace && visibleEntities(config).has(endpointKey(id))) navigateSpace(object.linkedSpace);
    else if (moveFocus) viewer?.focusObject(id);
    if (moveFocus) get<HTMLButtonElement>('close-inspector').focus({ preventScroll: true });
  }
  function selectEntity(endpoint: ConnectionEndpoint): void {
    const ref = endpointRef(endpoint);
    if (ref.kind === 'object') inspect(ref.id);
    else inspectScope(ref);
  }
  function renderConnections(panel: HTMLElement, endpoint: ConnectionEndpoint): void {
    const key = endpointKey(endpoint);
    const connections = config.connections.filter(c => endpointKey(c.from) === key || endpointKey(c.to) === key);
    panel.append(element('div', 'section-heading', `CONNECTIONS / ${connections.length}`));
    if (!connections.length) panel.append(element('p', 'muted', 'No connections defined.'));
    connections.forEach(connection => {
      const outgoing = endpointKey(connection.from) === key;
      const other = outgoing ? connection.to : connection.from;
      const button = element('button', 'connection-row');
      button.append(element('small', '', `${connection.direction === 'bidirectional' ? '↔ BIDIRECTIONAL' : outgoing ? 'OUTGOING →' : '← INCOMING'} ${connection.label ?? ''}`), element('span', '', `${endpointRef(other).kind}: ${endpointName(config, other)}`));
      button.onclick = () => selectEntity(other);
      panel.append(button);
      const label = element('label', 'property-field connection-direction', 'Direction');
      const select = element('select'); select.setAttribute('aria-label', `Direction of ${connection.label || connection.id}`);
      for (const [value, name] of [['forward', 'From → To'], ['bidirectional', 'Both directions ↔']]) {
        const option = element('option', '', name); option.value = value; select.append(option);
      }
      select.value = connection.direction;
      select.onchange = () => { connection.direction = select.value as typeof connection.direction; refreshConfiguration(); };
      label.append(select); panel.append(label, connectorControls(connection, refreshConfiguration, config.objectTypes));
    });
  }
  function groupPlaneControl(group: ArchitectureGroup): HTMLElement {
    const label = element('label', 'property-field', 'Parent plane');
    const select = element('select'); select.setAttribute('aria-label', 'Group parent plane');
    config.planes.forEach(plane => { const option = element('option', '', plane.name); option.value = plane.id; select.append(option); });
    select.value = group.plane;
    select.onchange = () => {
      const target = config.planes.find(plane => plane.id === select.value)!;
      if (config.objects.some(object => object.group === group.id && object.linkedSpace === target.space)) { select.value = group.plane; notify('This move would make a linked object open its own space. Change that object’s linked space first.'); return; }
      group.plane = target.id; changeSpaceView(enterSpace(config.spaceView, target.space), false, false); activePlane = target.id; refreshConfiguration();
    };
    label.append(select); return label;
  }
  function inspectScope(ref: EntityRef, moveFocus = true): void {
    if (ref.kind === 'space') { navigateSpace(ref.id); return; }
    if (ref.kind === 'object') { inspect(ref.id, moveFocus); return; }
    if (moveFocus) changeSpaceView(enterSpace(config.spaceView, endpointSpace(config, ref)), true, false);
    const entity = (ref.kind === 'plane' ? config.planes : config.groups).find(entry => entry.id === ref.id);
    if (!entity) return;
    selected = null; selectedScope = ref;
    activeGroup = ref.kind === 'group' ? ref.id : null;
    activePlane = ref.kind === 'plane' ? ref.id : config.groups.find(group => group.id === ref.id)!.plane;
    query = ''; typeFilter = 'all'; get<HTMLInputElement>('search').value = ''; get<HTMLSelectElement>('type-filter').value = 'all';
    get('inspector-label').textContent = `${ref.kind.toUpperCase()} INSPECTOR`;
    get('inspector-nav').hidden = true;
    const panel = get('inspector-content'); panel.replaceChildren();
    panel.append(element('div', 'inspector-icon', ref.kind === 'plane' ? '▱' : '▦'), element('h2', '', entity.name), visibilityControls(config, ref, entity, refreshConfiguration));
    if (ref.kind === 'plane') {
      const plane = config.planes.find(p => p.id === ref.id)!;
      const placed = layoutGroups(config).planes.find(p => p.id === ref.id)!;
      panel.append(element('p', 'muted', `Rendered footprint: ${placed.width} × ${placed.height} · ${placed.groups.length} groups`));
      if (placed.overflow) panel.append(element('p', 'error', 'Contents or spacing exceed this locked footprint. Increase dimensions, reduce spacing, or choose auto-fit.'));
      panel.append(planeControls(plane, refreshConfiguration), spacingControls(plane, config.spaces.find(space => space.id === plane.space), true, refreshConfiguration));
    } else {
      const group = config.groups.find(g => g.id === ref.id)!;
      const plane = config.planes.find(p => p.id === group.plane)!;
      panel.append(groupPlaneControl(group), elevationControl('inspect-group-elevation', 'Group elevation', group.elevation ?? 0, 'Relative to its parent plane.', value => { group.elevation = value; refreshConfiguration(); }), element('p', 'muted', `World elevation: ${plane.elevation + (group.elevation ?? 0)} (${plane.elevation} plane + ${group.elevation ?? 0} group)`));
    }
    if (ref.kind === 'group') { const group = config.groups.find(g => g.id === ref.id)!; panel.append(spacingControls(group, config.planes.find(p => p.id === group.plane), true, refreshConfiguration)); }
    renderConnections(panel, ref);
    openInspector(); renderDirectory();
    if (moveFocus) { if (ref.kind === 'plane') viewer?.focusPlane(ref.id); else viewer?.focusGroup(ref.id); }
    if (moveFocus) get<HTMLButtonElement>('close-inspector').focus({ preventScroll: true });
  }
  function openInspector(): void {
    get('inspector').hidden = false;
    document.querySelector('.workspace')?.classList.add('inspecting');
  }
  function renderPresentation(): void {
    const p = config.presentation;
    document.title = p.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', p.description);
    document.documentElement.style.setProperty('--accent', p.accent);
    document.documentElement.style.setProperty('--background', p.background);
    for (const [id, text] of [['brand-name', p.brand], ['eyebrow', p.eyebrow], ['headline', p.headline], ['description', p.description]]) get(id).textContent = text;
    get('group-count').textContent = String(config.groups.length).padStart(2, '0');
    get('object-count').textContent = String(config.objects.length).padStart(2, '0');
    get('connection-count').textContent = String(config.connections.length).padStart(2, '0');
    get('empty-state').hidden = config.objects.length > 0 || !viewer;
    syncControls();
  }
  function syncControls(): void {
    get<HTMLSelectElement>('model-theme').value = config.view.modelTheme;
    for (const [id, key] of [['names', 'showNames'], ['orbit', 'autoOrbit'], ['effects', 'effects'], ['grid', 'showGrid'], ['plane-frames', 'showPlaneFrames'], ['group-frames', 'showGroupFrames']] as const) {
      get(id).setAttribute('aria-pressed', String(config.view[key]));
    }
  }
  function apply(next: ArchitectureConfig): void {
    config = next; spaceHistory.length = 0; activeGroup = null; activePlane = null; query = ''; typeFilter = 'all';
    get<HTMLInputElement>('search').value = '';
    get<HTMLSelectElement>('type-filter').value = 'all';
    closeInspector();
    clearModelErrors(); renderCatalog();
    viewer?.setConfig(config);
    renderPresentation(); renderDirectory(); viewer?.focusSpace(config.spaceView.active);
    persist();
  }

  try { viewer = createViewer(get('scene-host'), inspect, inspectScope, reportModelError); }
  catch {
    get('scene-host').replaceChildren();
    get('fallback').hidden = false;
    get('scene-status').textContent = 'DIRECTORY VIEW';
    get('scene-host').hidden = true;
    document.querySelector('.stage-footer')?.setAttribute('hidden', '');
    for (const id of ['names', 'orbit', 'effects', 'reset-view']) get<HTMLButtonElement>(id).disabled = true;
  }
  viewer?.setConfig(config);
  function renderCatalog(): void {
    const filter = get<HTMLSelectElement>('type-filter'); filter.replaceChildren();
    const all = element('option', '', 'All types'); all.value = 'all'; filter.append(all);
    const grid = get('catalog-grid'); grid.replaceChildren();
    for (const type of getObjectCatalog(config.objectTypes)) {
      const option = element('option', '', type.name); option.value = type.id; filter.append(option);
      const card = element('article', 'catalog-card');
      card.append(element('div', 'catalog-symbol', type.symbol), element('h3', '', type.name), element('code', '', type.id), element('p', '', type.description));
      if (type.custom) card.append(element('small', 'muted', type.model ? `CUSTOM MODEL · ${type.model.url}` : `CUSTOM TYPE · ${type.shape}`));
      grid.append(card);
    }
    filter.value = typeFilter;
  }
  renderCatalog();
  const themeSelect = get<HTMLSelectElement>('model-theme');
  modelThemes.forEach(theme => {
    const option = element('option', '', theme.name); option.value = theme.id; option.title = theme.description; themeSelect.append(option);
  });
  themeSelect.onchange = () => {
    if (!isModelTheme(themeSelect.value)) return;
    config.view.modelTheme = themeSelect.value;
    clearModelErrors(); viewer?.setOptions(config.view); syncControls(); persist();
  };
  const disposeSpaces = mountSpaces(() => config, apply, changeSpaceView, refreshConfiguration);
  get<HTMLSelectElement>('space-focus').onchange = event => { const id = (event.target as HTMLSelectElement).value; changeSpaceView(id ? enterSpace(config.spaceView, id) : { ...config.spaceView, active: null }); };
  get('space-back').onclick = () => { const previous = spaceHistory.pop(); if (previous) changeSpaceView(previous, false); };
  get<HTMLInputElement>('search').oninput = event => {
    query = (event.target as HTMLInputElement).value.trim().toLowerCase(); closeInspector(); renderDirectory();
  };
  get<HTMLSelectElement>('type-filter').onchange = event => {
    typeFilter = (event.target as HTMLSelectElement).value; closeInspector(); renderDirectory();
  };
  get<HTMLSelectElement>('plane-filter').onchange = event => {
    activePlane = (event.target as HTMLSelectElement).value || null; activeGroup = null;
    closeInspector(); renderDirectory(); if (activePlane) viewer?.focusPlane(activePlane); else viewer?.focusGroup(null);
  };
  get('inspect-plane').onclick = () => { if (activePlane) inspectScope({ kind: 'plane', id: activePlane }); };
  get('close-inspector').onclick = () => { closeInspector(); renderDirectory(); if (activeGroup) viewer?.focusGroup(activeGroup); else if (activePlane) viewer?.focusPlane(activePlane); else viewer?.focusGroup(null); get<HTMLInputElement>('search').focus(); };
  get('reset-view').onclick = () => {
    activeGroup = null; activePlane = null; query = ''; typeFilter = 'all';
    get<HTMLInputElement>('search').value = ''; get<HTMLSelectElement>('type-filter').value = 'all';
    closeInspector(); renderDirectory(); viewer?.focusGroup(null);
  };
  for (const [id, key] of [['names', 'showNames'], ['orbit', 'autoOrbit'], ['effects', 'effects'], ['grid', 'showGrid'], ['plane-frames', 'showPlaneFrames'], ['group-frames', 'showGroupFrames']] as const) {
    get(id).onclick = () => { config.view[key] = !config.view[key]; viewer?.setOptions(config.view); syncControls(); if (selected) inspect(selected, false); else if (selectedScope) inspectScope(selectedScope, false); persist(); };
  }
  function step(delta: number): void {
    if (!selected || !config.objects.length) return;
    const index = config.objects.findIndex(o => o.id === selected);
    inspect(config.objects[(index + delta + config.objects.length) % config.objects.length].id);
  }
  get('previous-object').onclick = () => step(-1);
  get('next-object').onclick = () => step(1);
  get('config-button').onclick = () => {
    editor.value = JSON.stringify(config, null, 2);
    get('draft-notice').hidden = true;
    get('config-error').textContent = '';
    configDialog.showModal();
  };
  get('catalog-button').onclick = () => get<HTMLDialogElement>('catalog').showModal();
  document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => {
    button.onclick = () => get<HTMLDialogElement>(button.dataset.close!).close();
  });
  const disposePresets = mountPresetPicker((draft, name) => {
    editor.value = JSON.stringify(draft, null, 2);
    get('config-error').textContent = '';
    get('draft-notice').textContent = `${name} is ready to edit. Apply configuration to replace your current architecture, or close to keep it.`;
    get('draft-notice').hidden = false;
    configDialog.showModal();
  });
  get('restore-button').onclick = () => { editor.value = JSON.stringify(defaults, null, 2); get('config-error').textContent = ''; get('draft-notice').hidden = true; };
  get('apply-button').onclick = () => {
    try {
      const result = parseConfig(editor.value);
      apply(result.config); configDialog.close();
      if (result.warnings.length) notify(result.warnings.join(' '));
    } catch (error) { get('config-error').textContent = (error as Error).message; }
  };
  get('export-button').onclick = () => {
    try {
      const result = parseConfig(editor.value);
      const blob = new Blob([JSON.stringify(result.config, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = element('a'); link.href = url; link.download = 'architecture.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      get('config-error').textContent = '';
    } catch (error) { get('config-error').textContent = (error as Error).message; }
  };
  const fileInput = get<HTMLInputElement>('import-file');
  get('import-button').onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error('Configuration must be smaller than 2 MB.');
      const text = await file.text();
      parseConfig(text);
      editor.value = text; get('config-error').textContent = ''; get('draft-notice').hidden = true;
    } catch (error) { get('config-error').textContent = (error as Error).message; }
    fileInput.value = '';
  };
  const keyboard = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).matches('input,textarea,select') || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && (selected || selectedScope)) { get<HTMLButtonElement>('close-inspector').click(); }
    if (event.key === 'ArrowLeft' && selected) { event.preventDefault(); step(-1); }
    if (event.key === 'ArrowRight' && selected) { event.preventDefault(); step(1); }
  };
  window.addEventListener('keydown', keyboard);
  renderPresentation(); renderDirectory(); viewer?.focusSpace(config.spaceView.active);
  if (saved.notice) notify(saved.notice);
  return () => { disposeSpaces(); disposePresets(); viewer?.dispose(); clearTimeout(noticeTimer); window.removeEventListener('keydown', keyboard); };
}
