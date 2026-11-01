import type { ArchitectureConnection, ConnectionEndpoint } from '../config/types';
import { endpointRef } from '../config/connections';
import type { SceneLayout } from './layout';

export function connectionAnchor(layout: SceneLayout, endpoint: ConnectionEndpoint): [number, number, number] {
  const ref = endpointRef(endpoint);
  if (ref.kind === 'plane') {
    const plane = layout.planes.find(p => p.id === ref.id)!;
    return [plane.x, plane.y + 0.1, plane.z];
  }
  if (ref.kind === 'group') {
    const group = layout.groups.find(g => g.id === ref.id)!;
    return [group.x, group.y + 0.1, group.z];
  }
  const entry = layout.groups.flatMap(g => g.objects).find(o => o.object.id === ref.id)!;
  return [entry.x, entry.y + 1.5, entry.z];
}

/** Two simultaneous particles traverse the same path in opposite directions. */
export function packetProgress(phase: number, direction: ArchitectureConnection['direction']): number[] {
  const forward = ((phase % 1) + 1) % 1;
  return direction === 'bidirectional' ? [forward, 1 - forward] : [forward];
}
