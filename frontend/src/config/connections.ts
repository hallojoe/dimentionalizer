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
  const entries = ref.kind === 'plane' ? config.planes : ref.kind === 'group' ? config.groups : config.objects;
  return entries.find(entry => entry.id === ref.id)?.name ?? ref.id;
}
