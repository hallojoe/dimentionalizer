import type { ArchitectureConfig, ConnectionEndpoint, SpaceView } from './types';
import { endpointRef, endpointSpace } from './connections';
import { validateConfig } from './validate';

function allocator(existing: string[]) {
  const used = new Set(existing);
  return (suggestion: string) => {
    const base = suggestion.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'new';
    let id = /^[a-z]/.test(base) ? base : `s-${base}`, n = 2;
    const first = id;
    while (used.has(id)) id = `${first}-${n++}`;
    used.add(id); return id;
  };
}

/** Import a template as new spaces, remapping every relationship without mutating either input. */
export function appendSpaces(target: ArchitectureConfig, source: ArchitectureConfig, name: string): { config: ArchitectureConfig; spaceId: string } {
  if (!name.trim()) throw Error('Enter a space name.');
  const next = structuredClone(target);
  const maps = {
    space: new Map<string, string>(), plane: new Map<string, string>(), group: new Map<string, string>(), object: new Map<string, string>(),
  };
  for (const [kind, entries, existing] of [
    ['space', source.spaces, next.spaces], ['plane', source.planes, next.planes],
    ['group', source.groups, next.groups], ['object', source.objects, next.objects],
  ] as const) {
    const id = allocator(existing.map(entry => entry.id));
    entries.forEach(entry => maps[kind].set(entry.id, id(`${name}-${entry.id}`)));
  }
  const typeIds = new Map<string, string>();
  const allocateType = allocator([...next.objectTypes.map(t => t.id), ...next.objects.map(o => o.type ?? 'container'), ...next.connections.flatMap(c => c.flow ? [c.flow.out, ...(c.flow.in ? [c.flow.in] : [])] : [])]);
  for (const type of source.objectTypes) {
    const match = next.objectTypes.find(entry => JSON.stringify(entry) === JSON.stringify(type));
    const id = match?.id ?? allocateType(type.id);
    typeIds.set(type.id, id);
    if (!match) next.objectTypes.push({ ...structuredClone(type), id });
  }
  source.spaces.forEach((space, i) => next.spaces.push({ ...space, id: maps.space.get(space.id)!, name: i ? `${name} · ${space.name}` : name.trim() }));
  source.planes.forEach(plane => next.planes.push({ ...structuredClone(plane), id: maps.plane.get(plane.id)!, space: maps.space.get(plane.space)! }));
  source.groups.forEach(group => next.groups.push({ ...group, id: maps.group.get(group.id)!, plane: maps.plane.get(group.plane)! }));
  source.objects.forEach(object => next.objects.push({ ...object, id: maps.object.get(object.id)!, group: maps.group.get(object.group)!, type: typeIds.get(object.type ?? '') ?? object.type,
    ...(object.linkedSpace ? { linkedSpace: maps.space.get(object.linkedSpace) ?? object.linkedSpace } : {}),
  }));
  function endpoint(value: ConnectionEndpoint): ConnectionEndpoint {
    const ref = endpointRef(value), id = maps[ref.kind].get(ref.id)!;
    return typeof value === 'string' ? id : { kind: ref.kind, id };
  }
  const connectionId = allocator(next.connections.map(c => c.id));
  source.connections.forEach(connection => next.connections.push({ ...structuredClone(connection), id: connectionId(`${name}-${connection.id}`), from: endpoint(connection.from), to: endpoint(connection.to), ...(connection.flow ? { flow: { ...connection.flow, out: typeIds.get(connection.flow.out) ?? connection.flow.out, ...(connection.flow.in ? { in: typeIds.get(connection.flow.in) ?? connection.flow.in } : {}) } } : {}) }));
  const spaceId = maps.space.get(source.spaces[0].id)!;
  next.spaceView = { visible: [...new Set([...next.spaceView.visible, ...maps.space.values()])], active: spaceId };
  return { config: validateConfig(next).config, spaceId };
}

export function addBlankSpace(config: ArchitectureConfig, name: string) {
  const source = validateConfig({ schemaVersion: 1, groups: [{ id: 'contents', name: 'Contents' }], objects: [] }).config;
  return appendSpaces(config, source, name);
}

/** Duplicate the chosen space; preserve its portals to other spaces, omit boundary-crossing connectors. */
export function duplicateSpace(config: ArchitectureConfig, spaceId: string, name: string) {
  if (!config.spaces.some(space => space.id === spaceId)) throw Error('Choose an existing space to duplicate.');
  const source = structuredClone(config);
  source.spaces = source.spaces.filter(space => space.id === spaceId);
  source.planes = source.planes.filter(plane => plane.space === spaceId);
  source.groups = source.groups.filter(group => source.planes.some(plane => plane.id === group.plane));
  source.objects = source.objects.filter(object => source.groups.some(group => group.id === object.group));
  source.connections = source.connections.filter(connection => endpointSpace(config, connection.from) === spaceId && endpointSpace(config, connection.to) === spaceId);
  source.objectTypes = source.objectTypes.filter(type => source.objects.some(object => object.type === type.id) || source.connections.some(connection => connection.flow?.out === type.id || connection.flow?.in === type.id));
  return appendSpaces(config, source, name);
}

export function enterSpace(view: SpaceView, id: string): SpaceView {
  return { visible: [...new Set([...view.visible, id])], active: id };
}

export function toggleSpace(view: SpaceView, id: string, visible: boolean): SpaceView {
  const ids = visible ? [...new Set([...view.visible, id])] : view.visible.filter(entry => entry !== id);
  if (!ids.length) throw Error('Keep at least one space visible.');
  return { visible: ids, active: view.active && ids.includes(view.active) ? view.active : null };
}
