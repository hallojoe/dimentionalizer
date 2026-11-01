import type { ArchitectureConfig, ArchitectureGroup, ArchitectureObject, ArchitecturePlane } from '../config/types';

export interface PlacedGroup extends ArchitectureGroup {
  x: number; y: number; z: number; width: number; depth: number;
  objects: { object: ArchitectureObject; x: number; y: number; z: number }[];
}
export interface PlacedPlane extends ArchitecturePlane {
  x: number; y: number; z: number; depth: number;
  groups: PlacedGroup[];
  overflow: boolean;
}
export interface SceneLayout {
  planes: PlacedPlane[];
  groups: PlacedGroup[];
  size: number;
  centerY: number;
  warnings: string[];
}

/** Includes object tops and labels when framing any level of the hierarchy. */
export function groupViewBounds(group: PlacedGroup): { centerY: number; size: number } {
  const min = Math.min(group.y, ...group.objects.map(entry => entry.y));
  const max = Math.max(group.y, ...group.objects.map(entry => entry.y + 3.4));
  return { centerY: (min + max) / 2, size: Math.max(group.width, group.depth, max - min) };
}
export function planeViewBounds(plane: PlacedPlane): { centerY: number; size: number } {
  const heights = plane.groups.flatMap(group => [group.y, ...group.objects.flatMap(entry => [entry.y, entry.y + 3.4])]);
  const min = Math.min(plane.y, ...heights), max = Math.max(plane.y, ...heights);
  const width = Math.max(plane.width, ...plane.groups.map(g => 2 * Math.abs(g.x - plane.x) + g.width));
  const depth = Math.max(plane.depth, ...plane.groups.map(g => 2 * Math.abs(g.z - plane.z) + g.depth));
  return { centerY: (min + max) / 2, size: Math.max(width, depth, max - min) };
}

/** Center a set of rectangles using the original deterministic shelf algorithm. */
function pack<T extends { width: number; depth: number }>(entries: T[], gap: number, preferredWidth?: number) {
  const area = entries.reduce((sum, entry) => sum + (entry.width + gap) * (entry.depth + gap), 0);
  const shelf = Math.max(preferredWidth ?? Math.sqrt(area) * 1.25, ...entries.map(e => e.width), 20);
  let x = 0, z = 0, rowDepth = 0;
  const placed = entries.map(entry => {
    if (x && x + entry.width > shelf) { x = 0; z += rowDepth + gap; rowDepth = 0; }
    const result = { ...entry, x: x + entry.width / 2, z: z + entry.depth / 2 };
    x += entry.width + gap; rowDepth = Math.max(rowDepth, entry.depth);
    return result;
  });
  const width = Math.max(0, ...placed.map(e => e.x + e.width / 2));
  const depth = Math.max(0, ...placed.map(e => e.z + e.depth / 2));
  return { width, depth, entries: placed.map(e => ({ ...e, x: e.x - width / 2, z: e.z - depth / 2 })) };
}

/** Planes own groups; groups own items. Only the final placements are in world space. */
export function layoutGroups(config: ArchitectureConfig): SceneLayout {
  const padding = 4;
  const specs = config.planes.map(plane => {
    const members = config.groups.filter(group => group.plane === plane.id).map(group => {
      const objects = config.objects.filter(object => object.group === group.id);
      const columns = Math.max(1, Math.ceil(Math.sqrt(objects.length * 0.68)));
      const rows = Math.max(1, Math.ceil(objects.length / columns));
      return { ...group, objects, columns, rows, width: columns * 6 + 3, depth: rows * 4.5 + 3 };
    });
    const layout = pack(members, 10, plane.sizing === 'locked' ? plane.width - padding * 2 : undefined);
    const width = plane.sizing === 'locked' ? plane.width : Math.max(plane.width, layout.width + padding * 2);
    const depth = plane.sizing === 'locked' ? plane.height : Math.max(plane.height, layout.depth + padding * 2);
    return {
      plane, layout, surfaceWidth: width, surfaceDepth: depth,
      // Overflow is not clipped or silently scaled. Reserve its space between planes.
      width: Math.max(width, layout.width), depth: Math.max(depth, layout.depth),
      overflow: plane.sizing === 'locked' && (layout.width > width || layout.depth > depth),
    };
  });
  const world = pack(specs, 16);
  const planes: PlacedPlane[] = world.entries.map(spec => {
    const groups: PlacedGroup[] = spec.layout.entries.map(group => {
      const x = spec.x + group.x, z = spec.z + group.z;
      const y = spec.plane.elevation + (group.elevation ?? 0);
      return {
        ...group, x, y, z,
        objects: group.objects.map((object, i) => ({
          object,
          x: x + (i % group.columns - (group.columns - 1) / 2) * 6,
          y: y + (object.elevation ?? 0),
          z: z + (Math.floor(i / group.columns) - (group.rows - 1) / 2) * 4.5,
        })),
      };
    });
    return { ...spec.plane, x: spec.x, y: spec.plane.elevation, z: spec.z, width: spec.surfaceWidth, height: spec.surfaceDepth, depth: spec.surfaceDepth, groups, overflow: spec.overflow };
  });
  const groups = planes.flatMap(plane => plane.groups);
  const heights = planes.flatMap(plane => [plane.y, ...plane.groups.flatMap(group => [group.y, ...group.objects.flatMap(entry => [entry.y, entry.y + 3.4])])]);
  const minY = Math.min(0, ...heights), maxY = Math.max(0, ...heights);
  return {
    planes, groups,
    size: Math.max(world.width, world.depth, maxY - minY, 22),
    centerY: (minY + maxY) / 2,
    warnings: planes.filter(plane => plane.overflow).map(plane => `Contents extend beyond locked plane "${plane.name}". Increase its size or choose auto-fit.`),
  };
}
