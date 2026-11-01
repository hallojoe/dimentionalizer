import { resolveSpacing } from '../config/spacing';
import type { ArchitectureConfig, ArchitectureGroup, ArchitectureObject, ArchitecturePlane, ArchitectureSpace } from '../config/types';

export interface PlacedGroup extends ArchitectureGroup {
  x: number; y: number; z: number; width: number; depth: number;
  objects: { object: ArchitectureObject; x: number; y: number; z: number }[];
}
export interface PlacedPlane extends ArchitecturePlane {
  x: number; y: number; z: number; depth: number;
  groups: PlacedGroup[];
  overflow: boolean;
}
export interface PlacedSpace extends ArchitectureSpace {
  x: number; z: number; width: number; depth: number; planes: PlacedPlane[];
}
export interface SceneLayout {
  spaces: PlacedSpace[];
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

/** Cell dimensions include leaf padding/margin without scaling the object's visual. */
function objectGrid(objects: ArchitectureObject[], group: ArchitectureGroup) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(objects.length * 0.68)));
  const rows = Math.max(1, Math.ceil(objects.length / columns));
  const columnWidths = Array<number>(columns).fill(6), rowDepths = Array<number>(rows).fill(4.5);
  objects.forEach((object, i) => {
    const spacing = resolveSpacing(object, group), extra = 2 * (spacing.padding + spacing.margin);
    columnWidths[i % columns] = Math.max(columnWidths[i % columns], 6 + extra);
    rowDepths[Math.floor(i / columns)] = Math.max(rowDepths[Math.floor(i / columns)], 4.5 + extra);
  });
  const width = columnWidths.reduce((sum, value) => sum + value, 0), depth = rowDepths.reduce((sum, value) => sum + value, 0);
  return { width, depth, cells: objects.map((object, i) => {
    const column = i % columns, row = Math.floor(i / columns);
    return { object, x: columnWidths.slice(0, column).reduce((sum, value) => sum + value, 0) + columnWidths[column] / 2 - width / 2,
      z: rowDepths.slice(0, row).reduce((sum, value) => sum + value, 0) + rowDepths[row] / 2 - depth / 2 };
  }) };
}

/** Spacing is horizontal; only plane + group + item offsets determine world elevation. */
export function layoutGroups(config: ArchitectureConfig): SceneLayout {
  const specs = config.planes.map(plane => {
    const parentSpace = config.spaces.find(space => space.id === plane.space)!;
    const planeSpacing = resolveSpacing(plane, parentSpace);
    const members = config.groups.filter(group => group.plane === plane.id).map(group => {
      const spacing = resolveSpacing(group, plane);
      const grid = objectGrid(config.objects.filter(object => object.group === group.id), group);
      const surfaceWidth = grid.width + 3 + 2 * spacing.padding;
      const surfaceDepth = grid.depth + 3 + 2 * spacing.padding;
      return { group, grid, surfaceWidth, surfaceDepth, width: surfaceWidth + 2 * spacing.margin, depth: surfaceDepth + 2 * spacing.margin };
    });
    const inset = 4 + planeSpacing.padding;
    const layout = pack(members, 10, plane.sizing === 'locked' ? plane.width - inset * 2 : undefined);
    const requiredWidth = layout.width + inset * 2, requiredDepth = layout.depth + inset * 2;
    const width = plane.sizing === 'locked' ? plane.width : Math.max(plane.width, requiredWidth);
    const depth = plane.sizing === 'locked' ? plane.height : Math.max(plane.height, requiredDepth);
    const reservedWidth = plane.sizing === 'locked' ? layout.width + 2 * planeSpacing.padding : requiredWidth;
    const reservedDepth = plane.sizing === 'locked' ? layout.depth + 2 * planeSpacing.padding : requiredDepth;
    return {
      plane, layout, surfaceWidth: width, surfaceDepth: depth,
      // A locked surface never grows, but its spacing/overflow still reserves safe room.
      width: Math.max(width, reservedWidth) + 2 * planeSpacing.margin,
      depth: Math.max(depth, reservedDepth) + 2 * planeSpacing.margin,
      overflow: plane.sizing === 'locked' && (reservedWidth > width || reservedDepth > depth),
    };
  });
  const spaceSpecs = config.spaces.map(space => {
    const spacing = resolveSpacing(space);
    const packed = pack(specs.filter(spec => spec.plane.space === space.id), 16);
    const surfaceWidth = Math.max(packed.width + 2 * spacing.padding, 22), surfaceDepth = Math.max(packed.depth + 2 * spacing.padding, 22);
    return { space, packed, surfaceWidth, surfaceDepth, width: surfaceWidth + 2 * spacing.margin, depth: surfaceDepth + 2 * spacing.margin };
  });
  const world = pack(spaceSpecs, 35);
  const planeSpecs = world.entries.flatMap(space => space.packed.entries.map(spec => ({ ...spec, x: spec.x + space.x, z: spec.z + space.z })));
  const planes: PlacedPlane[] = planeSpecs.map(spec => {
    const groups: PlacedGroup[] = spec.layout.entries.map(member => {
      const x = spec.x + member.x, z = spec.z + member.z;
      const y = spec.plane.elevation + (member.group.elevation ?? 0);
      return {
        ...member.group, x, y, z, width: member.surfaceWidth, depth: member.surfaceDepth,
        objects: member.grid.cells.map(cell => ({ object: cell.object, x: x + cell.x, y: y + (cell.object.elevation ?? 0), z: z + cell.z })),
      };
    });
    return { ...spec.plane, x: spec.x, y: spec.plane.elevation, z: spec.z, width: spec.surfaceWidth, height: spec.surfaceDepth, depth: spec.surfaceDepth, groups, overflow: spec.overflow };
  });
  const groups = planes.flatMap(plane => plane.groups);
  const heights = planes.flatMap(plane => [plane.y, ...plane.groups.flatMap(group => [group.y, ...group.objects.flatMap(entry => [entry.y, entry.y + 3.4])])]);
  const minY = Math.min(0, ...heights), maxY = Math.max(0, ...heights);
  const spaces = world.entries.map(entry => ({ ...entry.space, x: entry.x, z: entry.z, width: entry.surfaceWidth, depth: entry.surfaceDepth, planes: planes.filter(plane => plane.space === entry.space.id) }));
  return {
    spaces, planes, groups,
    size: Math.max(world.width, world.depth, maxY - minY, 22),
    centerY: (minY + maxY) / 2,
    warnings: planes.filter(plane => plane.overflow).map(plane => `Contents or spacing exceed locked plane "${plane.name}". Increase its size, reduce spacing, or choose auto-fit.`),
  };
}

/** Frame only the chosen spaces, including their elevated and overflowing contents. */
export function spaceViewBounds(spaces: PlacedSpace[]): { x: number; z: number; centerY: number; size: number } {
  if (!spaces.length) return { x: 0, z: 0, centerY: 0, size: 22 };
  const minX = Math.min(...spaces.map(s => s.x - s.width / 2)), maxX = Math.max(...spaces.map(s => s.x + s.width / 2));
  const minZ = Math.min(...spaces.map(s => s.z - s.depth / 2)), maxZ = Math.max(...spaces.map(s => s.z + s.depth / 2));
  const heights = spaces.flatMap(s => s.planes.flatMap(p => [p.y, ...p.groups.flatMap(g => [g.y, ...g.objects.flatMap(o => [o.y, o.y + 3.4])])]));
  const minY = Math.min(0, ...heights), maxY = Math.max(0, ...heights);
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, centerY: (minY + maxY) / 2, size: Math.max(22, maxX - minX, maxZ - minZ, maxY - minY) };
}
