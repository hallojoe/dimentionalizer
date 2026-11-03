import type { ArchitectureConnection, ConnectionFlow } from './types';

export const flowDefaults: ConnectionFlow = { out: 'message', size: 1.4, duration: 5, gap: 0.7 };
export function resolveFlow(connection: ArchitectureConnection): Required<ConnectionFlow> {
  const flow = { ...flowDefaults, ...connection.flow };
  return { ...flow, in: flow.in ?? flow.out };
}
