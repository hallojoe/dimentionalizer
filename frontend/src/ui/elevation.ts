import { MAX_ELEVATION, validateElevation } from '../config/elevation';
import { element } from './dom';

/** Numeric control accepts signed fractional values; Reset restores the zero baseline. */
export function elevationControl(id: string, title: string, value: number, hint: string, onChange: (value: number) => void): HTMLElement {
  const field = element('div', 'elevation-field');
  const label = element('label', '', title); label.htmlFor = id;
  const row = element('div', 'elevation-input-row');
  const input = element('input');
  input.id = id; input.type = 'number'; input.step = 'any';
  input.min = String(-MAX_ELEVATION); input.max = String(MAX_ELEVATION);
  input.value = String(value); input.required = true;
  const help = element('small', 'muted', hint); help.id = `${id}-help`;
  const error = element('small', 'error'); error.id = `${id}-error`; error.setAttribute('role', 'alert');
  input.setAttribute('aria-describedby', `${help.id} ${error.id}`);
  const reset = element('button', '', 'Reset'); reset.type = 'button';
  reset.setAttribute('aria-label', `Reset ${title.toLowerCase()} to zero`);
  const commit = (next: number) => {
    try {
      validateElevation(next);
      error.textContent = ''; input.removeAttribute('aria-invalid');
      const hadFocus = document.activeElement === input;
      onChange(next);
      value = next; input.value = String(next);
      // The inspector can be redrawn to refresh the combined elevation.
      if (hadFocus) document.getElementById(id)?.focus({ preventScroll: true });
    } catch (reason) {
      error.textContent = (reason as Error).message;
      input.setAttribute('aria-invalid', 'true');
    }
  };
  input.onchange = () => commit(input.valueAsNumber);
  input.onkeydown = event => {
    if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
    if (event.key === 'Escape') { input.value = String(value); error.textContent = ''; input.removeAttribute('aria-invalid'); }
  };
  reset.onclick = () => commit(0);
  row.append(input, reset); field.append(label, row, help, error);
  return field;
}
