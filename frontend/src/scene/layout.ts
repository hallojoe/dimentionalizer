import type { ArchitectureConfig, ArchitectureGroup, ArchitectureObject } from '../config/types';

export interface PlacedGroup extends ArchitectureGroup {
  x: number; z: number; width: number; depth: number;
  objects: { object: ArchitectureObject; x: number; z: number }[];
}

/** Deterministic shelf layout, keeping platforms apart as the document grows. */
export function layoutGroups(config: ArchitectureConfig): { groups: PlacedGroup[]; size: number } {
  const specs = config.groups.map(group => {
    const objects = config.objects.filter(object => object.group === group.id);
    const columns = Math.max(1, Math.ceil(Math.sqrt(objects.length * 0.68)));
    const rows = Math.max(1, Math.ceil(objects.length / columns));
    return { ...group, columns, rows, objects, width: columns * 6 + 3, depth: rows * 4.5 + 3, x: 0, z: 0 };
  });
  const area = specs.reduce((sum, g) => sum + (g.width + 9) * (g.depth + 9), 0);
  const shelfWidth = Math.max(Math.sqrt(area) * 1.25, ...specs.map(g => g.width), 20);
  let x = 0, z = 0, rowDepth = 0;
  for (const group of specs) {
    if (x && x + group.width > shelfWidth) { x = 0; z += rowDepth + 10; rowDepth = 0; }
    group.x = x + group.width / 2;
    group.z = z + group.depth / 2;
    x += group.width + 10;
    rowDepth = Math.max(rowDepth, group.depth);
  }
  const maxX = Math.max(...specs.map(g => g.x + g.width / 2), 0);
  const maxZ = Math.max(...specs.map(g => g.z + g.depth / 2), 0);
  return {
    size: Math.max(maxX, maxZ, 22),
    groups: specs.map(g => ({
      ...g, x: g.x - maxX / 2, z: g.z - maxZ / 2,
      objects: g.objects.map((object, i) => ({
        object,
        x: g.x - maxX / 2 + (i % g.columns - (g.columns - 1) / 2) * 6,
        z: g.z - maxZ / 2 + (Math.floor(i / g.columns) - (g.rows - 1) / 2) * 4.5,
      })),
    })),
  };
}
