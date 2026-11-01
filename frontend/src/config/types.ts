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
  view: { showNames: boolean; effects: boolean; autoOrbit: boolean };
  groups: ArchitectureGroup[];
  objects: ArchitectureObject[];
  connections: ArchitectureConnection[];
}

export interface ArchitectureGroup { id: string; name: string; color: string }
export interface ArchitectureObject {
  id: string;
  name: string;
  group: string;
  /** Omitted and unrecognized types render as containers. */
  type?: string;
  description?: string;
}
export interface ArchitectureConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
}
export interface ValidationResult { config: ArchitectureConfig; warnings: string[] }
