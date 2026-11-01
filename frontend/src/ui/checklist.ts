import type { ArchitectureObject } from '../config/types';
import { element } from './dom';

export function checklistControls(object: ArchitectureObject, onChange: () => void): HTMLElement {
  const section = element('section', 'object-checklist');
  const items = object.checklist ?? [];
  if (!items.length) { section.hidden = true; return section; }
  const heading = element('div', 'section-heading');
  const update = () => { heading.textContent = `CHECKLIST / ${items.filter(item => item.done).length} OF ${items.length}`; };
  update(); section.append(heading);
  items.forEach(item => {
    const label = element('label', 'checklist-item'), input = element('input'); input.type = 'checkbox'; input.checked = item.done;
    const text = element('span', '', item.text); label.classList.toggle('completed', item.done);
    input.onchange = () => { item.done = input.checked; label.classList.toggle('completed', item.done); update(); onChange(); };
    label.append(input, text); section.append(label);
  });
  return section;
}
