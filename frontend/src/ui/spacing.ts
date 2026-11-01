import type { SpacedEntity, Spacing } from '../config/types';
import { resolveSpacing } from '../config/spacing';
import { element } from './dom';

export function spacingControls(entity: SpacedEntity, parent: SpacedEntity | undefined, hasChildren: boolean, onChange: () => void): HTMLElement {
  const section = element('section', 'spacing-controls');
  const effective = resolveSpacing(entity, parent);
  const label = element('label', 'property-check', 'Own spacing setting'), enabled = element('input'); enabled.type = 'checkbox'; enabled.checked = !!entity.spacing;
  enabled.onchange = () => {
    if (enabled.checked) entity.spacing = { mode: effective.rule?.mode ?? 'margin', target: 'self', value: effective.rule?.value ?? 2 };
    else delete entity.spacing;
    onChange();
  };
  label.prepend(enabled); section.append(element('div', 'section-heading', 'SPACING'), label);
  if (entity.spacing) {
    const spacing = entity.spacing;
    function choice<K extends 'mode' | 'target'>(key: K, title: string, options: [Spacing[K], string][]): void {
      const field = element('label', 'property-field', title), select = element('select');
      options.forEach(([value, text]) => { const option = element('option', '', text); option.value = value; select.append(option); });
      select.value = spacing[key]; select.onchange = () => { spacing[key] = select.value as Spacing[K]; onChange(); };
      field.append(select); section.append(field);
    }
    choice('mode', 'Mode', [['margin', 'Margin · outside'], ['padding', 'Padding · inside']]);
    if (hasChildren) choice('target', 'Apply to', [['self', 'This entity'], ['children', 'All direct children']]);
    const field = element('label', 'property-field', 'Extra space per side (X/Z)'), value = element('input');
    value.type = 'number'; value.min = '0'; value.max = '1000'; value.step = 'any'; value.required = true; value.value = String(spacing.value);
    value.onchange = () => { if (value.reportValidity()) { spacing.value = value.valueAsNumber; onChange(); } };
    field.append(value); section.append(field);
  }
  section.append(element('p', 'muted', entity.spacing?.target === 'children'
    ? 'Each direct child uses this setting unless it has its own. This entity keeps its baseline spacing.'
    : effective.inherited ? `Inherited ${effective.rule!.mode}: ${effective.rule!.value} per side. Enable an own setting to override, including zero.`
      : 'Adds room to the baseline layout. Elevation and model size stay unchanged.'));
  return section;
}
