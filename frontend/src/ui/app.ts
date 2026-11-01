import { objectCatalog, resolveType } from '../catalog/catalog';
import { parseConfig } from '../config/validate';
import { loadSaved, saveConfig } from '../config/storage';
import type { ArchitectureConfig, ArchitectureObject } from '../config/types';
import { createViewer } from '../scene/viewer';
import type { SceneViewer } from '../scene/viewer';
import { element, get } from './dom';
import { shell } from './shell';
import { mountPresetPicker } from './presets';
import { elevationControl } from './elevation';

export async function startApp(): Promise<() => void> {
  get('app').innerHTML = shell;
  const response = await fetch(`${import.meta.env.BASE_URL}architecture.json`);
  if (!response.ok) throw Error(`Could not load architecture.json (${response.status}).`);
  const defaults = parseConfig(await response.text()).config;
  const saved = loadSaved();
  let config = saved.config ?? structuredClone(defaults);
  let activeGroup: string | null = null;
  let selected: string | null = null;
  let query = '', typeFilter = 'all';
  let viewer: SceneViewer | undefined;
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
  function refreshElevation(): void {
    viewer?.setConfig(config, true);
    renderDirectory();
    if (selected) inspect(selected, false);
    else viewer?.focusGroup(activeGroup);
    persist();
  }
  function matches(object: ArchitectureObject): boolean {
    return (!activeGroup || object.group === activeGroup)
      && (typeFilter === 'all' || resolveType(object.type).id === typeFilter)
      && `${object.name} ${object.description ?? ''} ${object.type ?? 'container'}`.toLowerCase().includes(query);
  }
  function renderDirectory(): void {
    const groups = get('groups');
    groups.replaceChildren();
    function groupButton(id: string | null, name: string, count: number, color: string): void {
      const button = element('button', `group-button${id === activeGroup ? ' active' : ''}`);
      button.setAttribute('aria-pressed', String(id === activeGroup));
      const dot = element('span', 'group-dot'); dot.style.background = color;
      button.append(dot, element('span', '', name), element('small', '', String(count).padStart(2, '0')));
      button.onclick = () => { activeGroup = id; closeInspector(); renderDirectory(); viewer?.focusGroup(id); };
      groups.append(button);
    }
    groupButton(null, 'Entire network', config.objects.length, config.presentation.accent);
    config.groups.forEach(group => groupButton(group.id, group.name, config.objects.filter(o => o.group === group.id).length, group.color));
    const groupEditor = get('group-elevation-controls');
    groupEditor.replaceChildren();
    const currentGroup = config.groups.find(group => group.id === activeGroup);
    groupEditor.hidden = !currentGroup;
    if (currentGroup) groupEditor.append(elevationControl('group-elevation', 'Group elevation', currentGroup.elevation ?? 0, '0 = baseline · positive = above · negative = below', value => {
      currentGroup.elevation = value;
      refreshElevation();
    }));
    const objects = config.objects.filter(matches);
    const list = get('object-list');
    list.replaceChildren();
    objects.forEach(object => {
      const type = resolveType(object.type);
      const button = element('button', `object-row${object.id === selected ? ' selected' : ''}`);
      button.setAttribute('aria-label', `Inspect ${object.name}, ${type.name}`);
      button.setAttribute('aria-pressed', String(object.id === selected));
      const symbol = element('span', 'object-symbol', type.symbol);
      symbol.style.color = config.groups.find(g => g.id === object.group)!.color;
      const text = element('span', 'object-row-text');
      text.append(element('span', '', object.name), element('small', '', type.name));
      button.append(symbol, text, element('span', 'row-arrow', '↗'));
      button.onclick = () => inspect(object.id);
      list.append(button);
    });
    if (!objects.length) list.append(element('p', 'empty-list', config.objects.length ? 'No objects match these filters.' : 'No objects yet. Add some in Configure.'));
    get('visible-count').textContent = `${objects.length} / ${config.objects.length}`;
    get('scene-context').textContent = (config.groups.find(g => g.id === activeGroup)?.name ?? 'Entire network').toUpperCase();
    viewer?.setVisible(new Set(objects.map(o => o.id)));
    renderFallback(objects);
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
        const button = element('button', '', `${resolveType(object.type).symbol}  ${object.name}`);
        button.onclick = () => inspect(object.id);
        section.append(button);
      });
      summary.append(section);
    });
  }
  function closeInspector(): void {
    selected = null;
    get('inspector').hidden = true;
    document.querySelector('.workspace')?.classList.remove('inspecting');
  }
  function inspect(id: string, moveFocus = true): void {
    const object = config.objects.find(o => o.id === id);
    if (!object) return;
    // Connections can lead to an object outside the current group or search.
    if (!matches(object)) {
      activeGroup = null; query = ''; typeFilter = 'all';
      get<HTMLInputElement>('search').value = '';
      get<HTMLSelectElement>('type-filter').value = 'all';
    }
    selected = id;
    const group = config.groups.find(g => g.id === object.group)!;
    const type = resolveType(object.type);
    const panel = get('inspector-content');
    panel.replaceChildren();
    const icon = element('div', 'inspector-icon', type.symbol); icon.style.color = group.color;
    panel.append(icon, element('div', 'eyebrow', type.name.toUpperCase()), element('h2', '', object.name), element('span', 'tag', group.name), element('p', 'object-description', object.description || 'No description provided.'));
    const metadata = element('dl', 'metadata');
    for (const [label, value] of [['Object ID', object.id], ['Type', object.type ?? 'container']]) metadata.append(element('dt', '', label), element('dd', '', value));
    panel.append(metadata);
    const elevations = element('section', 'inspector-elevations');
    elevations.append(
      elevationControl('inspect-group-elevation', 'Group elevation', group.elevation ?? 0, 'Moves this group plane and all its objects.', value => {
        group.elevation = value; refreshElevation();
      }),
      elevationControl('item-elevation', 'Item elevation', object.elevation ?? 0, 'Relative to its group: 10 above, −10 below.', value => {
        object.elevation = value; refreshElevation();
      }),
      element('p', 'muted', `Combined elevation: ${(group.elevation ?? 0) + (object.elevation ?? 0)} (${group.elevation ?? 0} group + ${object.elevation ?? 0} item)`),
    );
    panel.append(elevations);
    const connections = config.connections.filter(c => c.from === id || c.to === id);
    panel.append(element('div', 'section-heading', `CONNECTIONS / ${connections.length}`));
    if (!connections.length) panel.append(element('p', 'muted', 'No connections defined.'));
    connections.forEach(connection => {
      const outgoing = connection.from === id;
      const other = config.objects.find(o => o.id === (outgoing ? connection.to : connection.from))!;
      const button = element('button', 'connection-row');
      button.append(element('small', '', `${outgoing ? 'OUTGOING →' : '← INCOMING'} ${connection.label ?? ''}`), element('span', '', other.name));
      button.onclick = () => inspect(other.id);
      panel.append(button);
    });
    get('object-position').textContent = `${config.objects.indexOf(object) + 1} / ${config.objects.length}`;
    get('inspector').hidden = false;
    document.querySelector('.workspace')?.classList.add('inspecting');
    renderDirectory();
    viewer?.focusObject(id);
    if (moveFocus) get<HTMLButtonElement>('close-inspector').focus({ preventScroll: true });
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
    for (const [id, key] of [['names', 'showNames'], ['orbit', 'autoOrbit'], ['effects', 'effects'], ['grid', 'showGrid']] as const) {
      get(id).setAttribute('aria-pressed', String(config.view[key]));
    }
  }
  function apply(next: ArchitectureConfig): void {
    config = next; activeGroup = null; query = ''; typeFilter = 'all';
    get<HTMLInputElement>('search').value = '';
    get<HTMLSelectElement>('type-filter').value = 'all';
    closeInspector();
    viewer?.setConfig(config);
    renderPresentation(); renderDirectory();
    persist();
  }

  try { viewer = createViewer(get('scene-host'), inspect); }
  catch {
    get('scene-host').replaceChildren();
    get('fallback').hidden = false;
    get('scene-status').textContent = 'DIRECTORY VIEW';
    get('scene-host').hidden = true;
    document.querySelector('.stage-footer')?.setAttribute('hidden', '');
    for (const id of ['names', 'orbit', 'effects', 'reset-view']) get<HTMLButtonElement>(id).disabled = true;
  }
  viewer?.setConfig(config);
  objectCatalog.forEach(type => {
    const option = element('option', '', type.name); option.value = type.id;
    get('type-filter').append(option);
    const card = element('article', 'catalog-card');
    card.append(element('div', 'catalog-symbol', type.symbol), element('h3', '', type.name), element('code', '', type.id), element('p', '', type.description));
    get('catalog-grid').append(card);
  });
  get<HTMLInputElement>('search').oninput = event => {
    query = (event.target as HTMLInputElement).value.trim().toLowerCase(); closeInspector(); renderDirectory();
  };
  get<HTMLSelectElement>('type-filter').onchange = event => {
    typeFilter = (event.target as HTMLSelectElement).value; closeInspector(); renderDirectory();
  };
  get('close-inspector').onclick = () => { closeInspector(); renderDirectory(); viewer?.focusGroup(activeGroup); get<HTMLInputElement>('search').focus(); };
  get('reset-view').onclick = () => {
    activeGroup = null; query = ''; typeFilter = 'all';
    get<HTMLInputElement>('search').value = ''; get<HTMLSelectElement>('type-filter').value = 'all';
    closeInspector(); renderDirectory(); viewer?.focusGroup(null);
  };
  for (const [id, key] of [['names', 'showNames'], ['orbit', 'autoOrbit'], ['effects', 'effects'], ['grid', 'showGrid']] as const) {
    get(id).onclick = () => { config.view[key] = !config.view[key]; viewer?.setOptions(config.view); syncControls(); persist(); };
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
    if (event.key === 'Escape' && selected) { get<HTMLButtonElement>('close-inspector').click(); }
    if (event.key === 'ArrowLeft' && selected) { event.preventDefault(); step(-1); }
    if (event.key === 'ArrowRight' && selected) { event.preventDefault(); step(1); }
  };
  window.addEventListener('keydown', keyboard);
  renderPresentation(); renderDirectory();
  if (saved.notice) notify(saved.notice);
  return () => { disposePresets(); viewer?.dispose(); clearTimeout(noticeTimer); window.removeEventListener('keydown', keyboard); };
}
