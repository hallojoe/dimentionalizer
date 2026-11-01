import type { ObjectType } from '../catalog/catalog';

/** Portable document model. IDs, not display names, define relationships. */
export interface ArchitectureConfig {
  schemaVersion: 1;
  presentation: {
    title: string;
    brand: string;
    eyebrow: string;
    headline: string;
    description: string;
    accent: string;
    background: string;
  };
  view: { showNames: boolean; effects: boolean; autoOrbit: boolean; showGrid: boolean };
  objectTypes: CustomObjectType[];
  planes: ArchitecturePlane[];
  groups: ArchitectureGroup[];
  objects: ArchitectureObject[];
  connections: ArchitectureConnection[];
}

export interface ArchitecturePlane {
  id: string;
  name: string;
  /** Horizontal X/Z footprint; auto mode treats these as minimum dimensions. */
  width: number;
  height: number;
  elevation: number;
  sizing: 'auto' | 'locked';
  decoration: { color: string; opacity: number; border: boolean; grid: boolean; label: boolean };
}

export interface ArchitectureGroup {
  id: string; name: string; color: string;
  plane: string;
  /** Signed height relative to its parent plane. Defaults to 0. */
  elevation?: number;
}
export interface ArchitectureObject {
  id: string;
  name: string;
  group: string;
  /** Omitted and unrecognized types render as containers. */
  type?: string;
  description?: string;
  /** Signed height relative to its group. Defaults to 0. */
  elevation?: number;
}
export interface ArchitectureConnection {
  id: string;
  from: ConnectionEndpoint;
  to: ConnectionEndpoint;
  label?: string;
  direction: 'forward' | 'bidirectional';
}
export interface EntityRef { kind: 'plane' | 'group' | 'object'; id: string }
/** Strings retain the version 1 shorthand for object endpoints. */
export type ConnectionEndpoint = string | EntityRef;
export interface ValidationResult { config: ArchitectureConfig; warnings: string[] }

/** Portable, declarative type definitions. No executable renderer code in documents. */
export interface CustomObjectType {
  id: string;
  name: string;
  symbol: string;
  description: string;
  /** Built-in appearance, also used while a model loads or if it fails. */
  shape: ObjectType;
  model?: { url: string; rotation: [number, number, number] };
}
