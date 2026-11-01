import type { ArchitectureConnection } from '../config/types';
import { element } from './dom';

export function connectorControls(connection: ArchitectureConnection, onChange: () => void): HTMLElement {
  const section = element('section', 'connector-controls');
  const style = element('label', 'property-field', 'Connector style'), select = element('select');
  for (const [id, name] of [['normal', 'Normal'], ['lightning', 'Lightning'], ['wobbly', 'Wobbly']]) {
    const option = element('option', '', name); option.value = id; select.append(option);
  }
  select.value = connection.style;
  select.onchange = () => { connection.style = select.value as ArchitectureConnection['style']; onChange(); };
  style.append(select); section.append(style);
  const label = element('label', 'property-check', 'Show capacity'), enabled = element('input'); enabled.type = 'checkbox'; enabled.checked = !!connection.capacity;
  enabled.onchange = () => { if (enabled.checked) connection.capacity = { out: 1, in: 1, unit: '' }; else delete connection.capacity; onChange(); };
  label.prepend(enabled); section.append(label);
  if (connection.capacity) {
    for (const [key, title] of [['out', 'Out · from → to'], ['in', 'In · to → from']] as const) {
      const field = element('label', 'property-field', title), input = element('input');
      input.type = 'number'; input.min = '0'; input.max = '1000000000'; input.step = 'any'; input.placeholder = 'Unspecified'; input.value = connection.capacity[key]?.toString() ?? '';
      input.onchange = () => {
        if (!input.reportValidity()) return;
        if (input.value === '') delete connection.capacity![key]; else connection.capacity![key] = input.valueAsNumber;
        if (connection.capacity!.out === undefined && connection.capacity!.in === undefined) delete connection.capacity;
        onChange();
      };
      field.append(input); section.append(field);
    }
    const field = element('label', 'property-field', 'Capacity unit'), unit = element('input'); unit.maxLength = 40; unit.placeholder = 'people/hour, Mbps, …'; unit.value = connection.capacity.unit;
    unit.onchange = () => { connection.capacity!.unit = unit.value.trim(); onChange(); }; field.append(unit); section.append(field);
    section.append(element('small', 'muted', 'Widths compare capacity within the same unit. Zero capacity pauses that lane’s dot. In uses the return lane when bidirectional.'));
  }
  return section;
}
