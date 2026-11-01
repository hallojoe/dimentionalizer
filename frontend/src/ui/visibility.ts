import type { ArchitectureConfig, ArchitectureGroup, ArchitectureObject, ArchitecturePlane, EntityRef } from '../config/types';
import { visibilityNote } from '../config/visibility';
import { element } from './dom';

export function visibilityControls(config: ArchitectureConfig, ref: EntityRef, entity: ArchitecturePlane | ArchitectureGroup | ArchitectureObject, onChange: () => void): HTMLElement {
  const section = element('section', 'visibility-controls');
  section.append(element('div', 'section-heading', 'VISIBILITY'));
  function toggle(title: string, checked: boolean, commit: (value: boolean) => void): void {
    const label = element('label', 'property-check', title), input = element('input');
    input.type = 'checkbox'; input.setAttribute('role', 'switch'); input.checked = checked;
    input.onchange = () => { commit(input.checked); onChange(); };
    label.prepend(input); section.append(label);
  }
  toggle(`Show ${ref.kind}`, entity.visible !== false, value => { entity.visible = value; });
  if (ref.kind === 'plane' || ref.kind === 'group') {
    const framed = entity as ArchitecturePlane | ArchitectureGroup;
    toggle('Show frame', framed.showFrame !== false, value => { framed.showFrame = value; });
    if (!config.view[ref.kind === 'plane' ? 'showPlaneFrames' : 'showGroupFrames']) section.append(element('p', 'muted', 'Frames are currently hidden by the view controls. This individual setting is preserved.'));
  }
  section.append(element('p', 'muted', entity.visible !== false && visibilityNote(config, ref)
    ? 'Hidden by a parent. Show the parent plane or group to reveal this entity.'
    : ref.kind === 'object' ? 'Hides the object, its label, and its connectors. Restore it here from the directory.'
      : 'Hiding this entity also hides its contents and connectors. Hiding only its frame leaves contents visible.'));
  return section;
}
