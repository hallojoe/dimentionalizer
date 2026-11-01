import type { ArchitectureConfig, ConnectionEndpoint, EntityRef } from './types';

export function endpointRef(endpoint: ConnectionEndpoint): EntityRef {
  return typeof endpoint === 'string' ? { kind: 'object', id: endpoint } : endpoint;
}
export function endpointKey(endpoint: ConnectionEndpoint): string {
  const ref = endpointRef(endpoint);
  return JSON.stringify([ref.kind, ref.id]);
}
export function endpointName(config: ArchitectureConfig, endpoint: ConnectionEndpoint): string {
  const ref = endpointRef(endpoint);
  const entries = ref.kind === 'space' ? config.spaces : ref.kind === 'plane' ? config.planes : ref.kind === 'group' ? config.groups : config.objects;
  return entries.find(entry => entry.id === ref.id)?.name ?? ref.id;
}

/** Resolve the space of any endpoint using the document's parent relationships. */
export function endpointSpace(config: ArchitectureConfig, endpoint: ConnectionEndpoint): string {
  const ref = endpointRef(endpoint);
  if (ref.kind === 'space') return ref.id;
  const group = ref.kind === 'object' ? config.objects.find(object => object.id === ref.id)!.group : ref.id;
  const plane = ref.kind === 'plane' ? ref.id : config.groups.find(entry => entry.id === group)!.plane;
  return config.planes.find(entry => entry.id === plane)!.space;
}
