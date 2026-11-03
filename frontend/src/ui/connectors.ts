import type { ArchitectureConnection, CustomObjectType } from '../config/types';
import { flowDefaults, resolveFlow } from '../config/flow';
import { getObjectCatalog } from '../catalog/catalog';
import { element } from './dom';

export function connectorControls(connection: ArchitectureConnection, onChange: () => void, customTypes: readonly CustomObjectType[] = []): HTMLElement {
  const section = element('section', 'connector-controls');
  const flow = resolveFlow(connection), catalog = getObjectCatalog(customTypes);
  section.append(element('div', 'section-heading', 'MOVING CONNECTION MODELS'));
  const ownFlow = () => connection.flow ??= { ...flowDefaults };
  for (const [key, title] of [['out', 'From → To model'], ['in', 'To → From model']] as const) {
    if (key === 'in' && connection.direction !== 'bidirectional') continue;
    const field = element('label', 'property-field', title), model = element('select');
    if (key === 'in') { const same = element('option', '', 'Same as From → To'); same.value = ''; model.append(same); }
    const current = key === 'out' ? flow.out : connection.flow?.in ?? '';
    if (current && !catalog.some(type => type.id === current)) { const unknown = element('option', '', `${current} (Container fallback)`); unknown.value = current; model.append(unknown); }
    catalog.forEach(type => { const option = element('option', '', `${type.name}${type.custom ? ' · custom' : ''}`); option.value = type.id; model.append(option); });
    model.value = current;
    model.onchange = () => { const next = ownFlow(); if (key === 'in' && !model.value) delete next.in; else next[key] = model.value; onChange(); };
    field.append(model); section.append(field);
  }
  for (const [key, title, min, max] of [
    ['size', 'Model size (scene units)', 0.2, 6],
    ['duration', 'Travel time (seconds)', 0.5, 60],
    ['gap', 'Pause after arrival (seconds)', 0, 30],
  ] as const) {
    const field = element('label', 'property-field', title), input = element('input');
    input.type = 'number'; input.required = true; input.min = String(min); input.max = String(max); input.step = 'any'; input.value = String(flow[key]);
    input.onchange = () => { if (input.reportValidity()) { ownFlow()[key] = input.valueAsNumber; onChange(); } };
    field.append(input); section.append(field);
  }
  section.append(element('p', 'muted', 'Models grow and fade in at the source, then shrink and fade out at arrival. Use Key / Login for access and E-mail for delivery. Effects must be on; reduced motion shows stationary models.'));
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
    section.append(element('small', 'muted', 'Widths compare capacity within the same unit. Zero capacity hides that lane’s moving model. In uses the return lane when bidirectional.'));
  }
  return section;
}
