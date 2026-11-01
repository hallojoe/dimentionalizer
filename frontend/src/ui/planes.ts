import type { ArchitecturePlane } from '../config/types';
import { elevationControl } from './elevation';
import { element } from './dom';

export function planeControls(plane: ArchitecturePlane, onChange: () => void): HTMLElement {
  const section = element('section', 'plane-controls');
  section.append(elevationControl('plane-elevation', 'Plane elevation', plane.elevation, 'Relative to world zero; moves all groups and items on this plane.', value => { plane.elevation = value; onChange(); }));
  const sizing = element('label', 'property-field', 'Size mode');
  const select = element('select'); select.setAttribute('aria-label', 'Plane size mode');
  for (const [value, title] of [['auto', 'Auto-fit contents'], ['locked', 'Locked dimensions']]) {
    const option = element('option', '', title); option.value = value; select.append(option);
  }
  select.value = plane.sizing;
  select.onchange = () => { plane.sizing = select.value as ArchitecturePlane['sizing']; onChange(); };
  sizing.append(select); section.append(sizing);
  function numberField(title: string, value: number, min: number, max: number, commit: (value: number) => void): void {
    const label = element('label', 'property-field', title);
    const input = element('input'); input.type = 'number'; input.step = 'any'; input.required = true;
    input.min = String(min); input.max = String(max); input.value = String(value);
    input.onchange = () => { if (input.reportValidity()) { commit(input.valueAsNumber); onChange(); } };
    label.append(input); section.append(label);
  }
  numberField(plane.sizing === 'auto' ? 'Minimum width (X)' : 'Width (X)', plane.width, 1, 10000, value => { plane.width = value; });
  numberField(plane.sizing === 'auto' ? 'Minimum height (Z)' : 'Height (Z)', plane.height, 1, 10000, value => { plane.height = value; });
  const colorLabel = element('label', 'property-field', 'Plane color');
  const color = element('input'); color.type = 'color'; color.value = plane.decoration.color;
  color.onchange = () => { plane.decoration.color = color.value; onChange(); };
  colorLabel.append(color); section.append(colorLabel);
  numberField('Fill opacity', plane.decoration.opacity, 0, 1, value => { plane.decoration.opacity = value; });
  for (const [key, title] of [['border', 'Show border'], ['grid', 'Show plane grid'], ['label', 'Show plane label']] as const) {
    const label = element('label', 'property-check', title);
    const input = element('input'); input.type = 'checkbox'; input.checked = plane.decoration[key];
    input.onchange = () => { plane.decoration[key] = input.checked; onChange(); };
    label.prepend(input); section.append(label);
  }
  return section;
}
