import { endpointKey } from './connections';
import type { ArchitectureConfig, EntityRef } from './types';

/** Parent visibility gates descendants without changing their own saved switches. */
export function visibleEntities(config: ArchitectureConfig, spaces = config.spaceView.visible): Set<string> {
  const visible = new Set(spaces.map(id => endpointKey({ kind: 'space', id })));
  for (const plane of config.planes) if (plane.visible !== false && visible.has(endpointKey({ kind: 'space', id: plane.space }))) visible.add(endpointKey({ kind: 'plane', id: plane.id }));
  for (const group of config.groups) if (group.visible !== false && visible.has(endpointKey({ kind: 'plane', id: group.plane }))) visible.add(endpointKey({ kind: 'group', id: group.id }));
  for (const object of config.objects) if (object.visible !== false && visible.has(endpointKey({ kind: 'group', id: object.group }))) visible.add(endpointKey(object.id));
  return visible;
}

/** Frames are presentation only. They never gate contents or connectors. */
export function sceneVisibility(config: ArchitectureConfig, candidates: Set<string>, spaces = config.spaceView.visible, view = config.view) {
  const entities = visibleEntities(config, spaces);
  const objects = new Set([...candidates].filter(id => entities.has(endpointKey(id))));
  const endpoints = new Set([...objects].map(id => endpointKey(id)));
  const frames = new Set<string>();
  const matchingGroups = new Set<string>();
  for (const space of spaces) { const key = endpointKey({ kind: 'space', id: space }); endpoints.add(key); frames.add(key); }
  for (const group of config.groups) {
    const key = endpointKey({ kind: 'group', id: group.id });
    const children = config.objects.filter(object => object.group === group.id);
    if (!children.length || children.some(object => candidates.has(object.id))) matchingGroups.add(group.id);
    if (!entities.has(key)) continue;
    if (view.showGroupFrames && group.showFrame !== false) frames.add(key);
    if (matchingGroups.has(group.id)) endpoints.add(key);
  }
  for (const plane of config.planes) {
    const key = endpointKey({ kind: 'plane', id: plane.id });
    if (!entities.has(key)) continue;
    if (view.showPlaneFrames && plane.showFrame !== false) frames.add(key);
    const children = config.groups.filter(group => group.plane === plane.id);
    if (!children.length || children.some(group => matchingGroups.has(group.id))) endpoints.add(key);
  }
  return { objects, endpoints, frames };
}

export function visibilityNote(config: ArchitectureConfig, ref: EntityRef): string {
  // Directory status describes entity switches, independently of the current space view.
  const entities = visibleEntities(config, config.spaces.map(space => space.id));
  return entities.has(endpointKey(ref)) ? '' : 'Hidden';
}
