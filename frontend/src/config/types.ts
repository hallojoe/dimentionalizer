import type { ModelTheme } from '../catalog/themes';
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
  view: { modelTheme: ModelTheme; showNames: boolean; effects: boolean; autoOrbit: boolean; showGrid: boolean; showPlaneFrames: boolean; showGroupFrames: boolean };
  spaces: ArchitectureSpace[];
  spaceView: SpaceView;
  objectTypes: CustomObjectType[];
  planes: ArchitecturePlane[];
  groups: ArchitectureGroup[];
  objects: ArchitectureObject[];
  connections: ArchitectureConnection[];
}

export interface Spacing { mode: 'margin' | 'padding'; target: 'self' | 'children'; value: number }
export interface SpacedEntity { spacing?: Spacing }
export interface VisibleEntity { visible?: boolean }
export interface FramedEntity extends VisibleEntity { showFrame?: boolean }

export interface ArchitectureSpace extends SpacedEntity { id: string; name: string; description: string }
export interface SpaceView { visible: string[]; active: string | null }

export interface ArchitecturePlane extends SpacedEntity, FramedEntity {
  space: string;
  id: string;
  name: string;
  /** Horizontal X/Z footprint; auto mode treats these as minimum dimensions. */
  width: number;
  height: number;
  elevation: number;
  sizing: 'auto' | 'locked';
  decoration: { color: string; opacity: number; border: boolean; grid: boolean; label: boolean };
}

export interface ArchitectureGroup extends SpacedEntity, FramedEntity {
  id: string; name: string; color: string;
  plane: string;
  /** Signed height relative to its parent plane. Defaults to 0. */
  elevation?: number;
}
export interface ArchitectureObject extends SpacedEntity, VisibleEntity {
  checklist?: { id: string; text: string; done: boolean }[];
  /** Clicking the object enters this space, without changing its parent group. */
  linkedSpace?: string;
  id: string;
  name: string;
  group: string;
  /** Omitted and unrecognized types render as containers. */
  type?: string;
  description?: string;
  /** Signed height relative to its group. Defaults to 0. */
  elevation?: number;
}
export interface ConnectionFlow { out: string; in?: string; size: number; duration: number; gap: number }
export interface ArchitectureConnection {
  /** Animated model types, independent of the endpoint object types. */
  flow?: ConnectionFlow;
  id: string;
  from: ConnectionEndpoint;
  to: ConnectionEndpoint;
  label?: string;
  direction: 'forward' | 'bidirectional';
  style: 'normal' | 'lightning' | 'wobbly';
  capacity?: { out?: number; in?: number; unit: string };
}
export interface EntityRef { kind: 'space' | 'plane' | 'group' | 'object'; id: string }
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
