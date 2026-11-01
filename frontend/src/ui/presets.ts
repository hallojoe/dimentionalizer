import { loadPreset, presetCatalog } from '../presets/catalog';
import type { ArchitectureConfig } from '../config/types';
import { element, get } from './dom';

/** Loads a validated editor draft; never mutates the active architecture or storage. */
export function mountPresetPicker(onLoadDraft: (config: ArchitectureConfig, name: string) => void): () => void {
  const dialog = get<HTMLDialogElement>('presets');
  const grid = get('preset-grid');
  const error = get('preset-error');
  let request: AbortController | undefined;
  const buttons: HTMLButtonElement[] = [];

  function cancel(): void {
    request?.abort(); request = undefined;
    grid.removeAttribute('aria-busy');
    buttons.forEach(button => { button.disabled = false; button.textContent = 'Open editable preset ↗'; });
  }
  const categories = [...new Set(presetCatalog.map(preset => preset.category))];
  const categorySelect = get<HTMLSelectElement>('preset-category');
  const all = element('option', '', 'All categories'); all.value = ''; categorySelect.append(all);
  categories.forEach(category => { const option = element('option', '', category); option.value = category; categorySelect.append(option); });
  categorySelect.onchange = () => { for (const child of grid.children) (child as HTMLElement).hidden = !!categorySelect.value && (child as HTMLElement).dataset.category !== categorySelect.value; };
  let lastCategory = '';
  get('presets-button').onclick = () => { error.textContent = ''; dialog.showModal(); };
  for (const preset of presetCatalog) {
    if (preset.category !== lastCategory) { const heading = element('h3', 'preset-category-heading', preset.category); heading.dataset.category = preset.category; grid.append(heading); lastCategory = preset.category; }
    const card = element('article', 'preset-card'); card.dataset.category = preset.category;
    card.append(element('div', 'eyebrow', preset.category.toUpperCase()), element('h3', '', preset.name), element('p', '', preset.summary));
    card.append(element('div', 'preset-counts', `${preset.groups} groups · ${preset.objects} objects · ${preset.connections} connections`));
    if (preset.source) {
      const source = element('a', 'preset-source', `${preset.source.label} ↗`);
      source.href = preset.source.url;
      source.target = '_blank'; source.rel = 'noopener noreferrer';
      source.title = `Source snapshot: ${preset.source.revision}`;
      card.append(source);
    } else {
      card.append(element('span', 'preset-source', 'Illustrative reference architecture'));
    }
    const button = element('button', '', 'Open editable preset ↗');
    button.setAttribute('aria-label', `Open ${preset.name} preset`);
    button.onclick = async () => {
      cancel();
      const controller = new AbortController(); request = controller;
      error.textContent = '';
      grid.setAttribute('aria-busy', 'true');
      buttons.forEach(item => { item.disabled = true; });
      button.textContent = 'Loading…';
      try {
        const config = await loadPreset(preset.id, import.meta.env.BASE_URL, controller.signal);
        if (controller.signal.aborted || !dialog.open) return;
        dialog.close();
        onLoadDraft(config, preset.name);
      } catch (reason) {
        if (!controller.signal.aborted) error.textContent = (reason as Error).message;
      } finally {
        if (request === controller) cancel();
      }
    };
    buttons.push(button); card.append(button); grid.append(card);
  }
  dialog.addEventListener('close', cancel);
  return () => { cancel(); dialog.removeEventListener('close', cancel); };
}
