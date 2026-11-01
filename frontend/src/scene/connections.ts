import * as THREE from 'three';
import type { ArchitectureConnection, ConnectionEndpoint } from '../config/types';
import { endpointRef } from '../config/connections';
import type { SceneLayout } from './layout';

export function connectionAnchor(layout: SceneLayout, endpoint: ConnectionEndpoint): [number, number, number] {
  const ref = endpointRef(endpoint);
  if (ref.kind === 'space') {
    const space = layout.spaces.find(s => s.id === ref.id)!;
    return [space.x, 0.1, space.z];
  }
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

export function capacityRadius(value: number | undefined, maximum: number): number {
  if (value === undefined) return 0.025;
  if (value === 0) return 0.015;
  return 0.04 + 0.22 * Math.sqrt(value / Math.max(value, maximum, Number.MIN_VALUE));
}

export function capacityMaximum(connections: ArchitectureConnection[], unit: string): number {
  return Math.max(0, ...connections.filter(c => c.capacity?.unit === unit).flatMap(c => [c.capacity?.out ?? 0, c.capacity?.in ?? 0]));
}

export function connectorPath(start: THREE.Vector3, end: THREE.Vector3, style: ArchitectureConnection['style'], lane = 0): THREE.Curve<THREE.Vector3> {
  const delta = end.clone().sub(start);
  const perpendicular = new THREE.Vector3(-delta.z, 0, delta.x).normalize();
  if (perpendicular.lengthSq() === 0) perpendicular.set(1, 0, 0);
  const length = start.distanceTo(end), points: THREE.Vector3[] = [];
  const segments = style === 'lightning' ? 12 : 40;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, envelope = Math.sin(t * Math.PI);
    const point = start.clone().lerp(end, t);
    point.y += envelope * Math.max(1, Math.min(length * 0.13, 5));
    const wave = style === 'lightning' ? (i % 2 ? 0.65 : -0.65) : style === 'wobbly' ? Math.sin(t * Math.PI * 10) * 0.5 : 0;
    point.addScaledVector(perpendicular, envelope * (wave + lane + (length < 0.01 ? 3 : 0)));
    points.push(point);
  }
  if (style !== 'lightning') return new THREE.CatmullRomCurve3(points);
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
  return curve;
}
