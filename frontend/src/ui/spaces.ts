import type { ArchitectureConfig, SpaceView } from '../config/types';
import { addBlankSpace, appendSpaces, duplicateSpace, toggleSpace } from '../config/spaces';
import { loadPreset, presetCatalog } from '../presets/catalog';
import { spacingControls } from './spacing';
import { element, get } from './dom';

export function mountSpaces(getConfig: () => ArchitectureConfig, apply: (config: ArchitectureConfig) => void, setView: (view: SpaceView) => void, onSpacingChange: () => void): () => void {
  const dialog = get<HTMLDialogElement>('spaces-dialog'), error = get('spaces-error');
  const mode = get<HTMLSelectElement>('space-create-mode'), source = get<HTMLSelectElement>('space-create-source');
  let request: AbortController | undefined;
  function sources(): void {
    source.replaceChildren(); source.hidden = mode.value === 'blank';
    get('space-source-label').hidden = mode.value === 'blank';
    if (mode.value === 'duplicate') {
      getConfig().spaces.forEach(space => { const option = element('option', '', space.name); option.value = space.id; source.append(option); });
      source.value = getConfig().spaceView.active ?? getConfig().spaces[0].id;
    } else if (mode.value === 'template') {
      for (const category of [...new Set(presetCatalog.map(p => p.category))]) {
        const group = element('optgroup'); group.label = category;
        presetCatalog.filter(p => p.category === category).forEach(preset => { const option = element('option', '', preset.name); option.value = preset.id; group.append(option); });
        source.append(group);
      }
    }
  }
  function render(): void {
    const config = getConfig(), list = get('space-list'); list.replaceChildren();
    config.spaces.forEach(space => {
      const row = element('div', 'space-row'), label = element('label', 'property-check', space.name);
      const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = config.spaceView.visible.includes(space.id);
      checkbox.onchange = () => {
        try { setView(toggleSpace(getConfig().spaceView, space.id, checkbox.checked)); error.textContent = ''; }
        catch (reason) { checkbox.checked = !checkbox.checked; error.textContent = (reason as Error).message; }
      };
      label.prepend(checkbox);
      const only = element('button', '', 'View alone'); only.onclick = () => { setView({ visible: [space.id], active: space.id }); render(); };
      row.append(label, only);
      const details = element('details', 'space-spacing'); details.append(element('summary', '', `Spacing · ${space.name}`));
      const controls = element('div');
      const update = () => { controls.replaceChildren(spacingControls(space, undefined, true, () => { onSpacingChange(); update(); })); };
      update(); details.append(controls); list.append(row, details);
    });
    sources();
  }
  get('spaces-button').onclick = () => { error.textContent = ''; render(); dialog.showModal(); };
  get('spaces-show-all').onclick = () => { setView({ visible: getConfig().spaces.map(s => s.id), active: null }); render(); };
  mode.onchange = sources;
  get<HTMLFormElement>('space-create-form').onsubmit = async event => {
    event.preventDefault(); request?.abort();
    const controller = new AbortController(); request = controller;
    const button = get<HTMLButtonElement>('space-create-button'); button.disabled = true; error.textContent = '';
    const name = get<HTMLInputElement>('space-create-name').value;
    try {
      const config = getConfig();
      const result = mode.value === 'blank' ? addBlankSpace(config, name) : mode.value === 'duplicate'
        ? duplicateSpace(config, source.value, name)
        : appendSpaces(config, await loadPreset(source.value, import.meta.env.BASE_URL, controller.signal), name);
      if (controller.signal.aborted) return;
      apply(result.config); dialog.close();
    } catch (reason) { if (!controller.signal.aborted) error.textContent = (reason as Error).message; }
    finally { if (request === controller) { request = undefined; button.disabled = false; } }
  };
  const cancel = () => { request?.abort(); request = undefined; get<HTMLButtonElement>('space-create-button').disabled = false; };
  dialog.addEventListener('close', cancel);
  return () => { cancel(); dialog.removeEventListener('close', cancel); };
}
