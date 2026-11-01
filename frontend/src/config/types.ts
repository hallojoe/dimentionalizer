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
  groups: ArchitectureGroup[];
  objects: ArchitectureObject[];
  connections: ArchitectureConnection[];
}

export interface ArchitectureGroup {
  id: string; name: string; color: string;
  /** Signed height of the group plane above/below world zero. Defaults to 0. */
  elevation?: number;
}
export interface ArchitectureObject {
  id: string;
  name: string;
  group: string;
  /** Omitted and unrecognized types render as containers. */
  type?: string;
  description?: string;
  /** Signed height relative to the group plane. Defaults to 0. */
  elevation?: number;
}
export interface ArchitectureConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
}
export interface ValidationResult { config: ArchitectureConfig; warnings: string[] }
