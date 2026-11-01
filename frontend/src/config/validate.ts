import { isKnownType } from '../catalog/catalog';
import { palette, presentationDefaults, viewDefaults } from './defaults';
import type { ArchitectureConfig, ConnectionEndpoint, CustomObjectType, ValidationResult } from './types';
import { validateElevation } from './elevation';
import { endpointKey } from './connections';
import { validateModelUrl } from './model-url';
import type { ObjectType } from '../catalog/catalog';

type RecordValue = Record<string, unknown>;
function record(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${path} must be an object.`);
  return value as RecordValue;
}
function string(value: unknown, path: string, fallback?: string): string {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !value.trim()) throw Error(`${path} must be a non-empty string.`);
  if (value.length > 10000) throw Error(`${path} is too long (maximum 10,000 characters).`);
  return value;
}
function optionalText(value: unknown, path: string): string {
  if (value === undefined || value === '') return '';
  return string(value, path);
}
function color(value: unknown, path: string, fallback: string): string {
  const result = string(value, path, fallback);
  if (!/^#[0-9a-f]{6}$/i.test(result)) throw Error(`${path} must be a six-digit hex color, for example #b8ff6c.`);
  return result;
}
function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw Error(`${path} must be an array with at most ${max} entries.`);
  return value;
}
function unique(ids: string[], path: string): void {
  if (new Set(ids).size !== ids.length) throw Error(`${path} contains duplicate IDs.`);
}
function number(value: unknown, path: string, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error(`${path} must be a number between ${min} and ${max}.`);
  return value;
}
function boolean(value: unknown, path: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw Error(`${path} must be true or false.`);
  return value;
}

/** Migrates the original Sites array without inferring specialized types from names. */
function migrateLegacy(input: unknown[]): unknown {
  const names = new Set<string>();
  const objects = input.map((value, index) => {
    const item = record(value, `Item ${index + 1}`);
    const group = string(item.group, `Item ${index + 1}.group`);
    names.add(group);
    return { id: `object-${index + 1}`, name: item.name, group, description: item.text, type: 'container' };
  });
  const groups = [...names].map((name, index) => ({ id: name, name, color: palette[index % palette.length] }));
  return { schemaVersion: 1, groups, objects, connections: [] };
}

/** Validates before changing state; emits a canonical document with explicit defaults. */
export function validateConfig(input: unknown): ValidationResult {
  const warnings: string[] = [];
  if (Array.isArray(input)) {
    input = migrateLegacy(input);
    warnings.push('Imported the legacy array format. Export to save it as a version 1 document.');
  }
  const value = record(input, 'Configuration');
  if (value.schemaVersion !== 1) throw Error('schemaVersion must be 1.');
  const p = record(value.presentation ?? {}, 'presentation');
  const v = record(value.view ?? {}, 'view');
  const presentation = { ...presentationDefaults };
  for (const key of Object.keys(presentationDefaults) as (keyof typeof presentation)[]) {
    presentation[key] = key === 'accent' || key === 'background'
      ? color(p[key], `presentation.${key}`, presentationDefaults[key])
      : string(p[key], `presentation.${key}`, presentationDefaults[key]);
  }
  const view = { ...viewDefaults };
  for (const key of Object.keys(viewDefaults) as (keyof typeof view)[]) {
    if (v[key] !== undefined && typeof v[key] !== 'boolean') throw Error(`view.${key} must be true or false.`);
    view[key] = (v[key] as boolean | undefined) ?? viewDefaults[key];
  }
  const objectTypes: CustomObjectType[] = array(value.objectTypes === undefined ? [] : value.objectTypes, 'objectTypes', 50).map((entry, i) => {
    const path = `objectTypes[${i}]`;
    const type = record(entry, path);
    const id = string(type.id, `${path}.id`);
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw Error(`${path}.id must be a lowercase slug.`);
    if (isKnownType(id)) throw Error(`${path}.id cannot replace a built-in type.`);
    const shape = string(type.shape, `${path}.shape`, 'container');
    if (!isKnownType(shape)) throw Error(`${path}.shape must name a built-in shape.`);
    const symbol = string(type.symbol, `${path}.symbol`, '◇');
    if ([...symbol].length > 8) throw Error(`${path}.symbol must be at most 8 characters.`);
    const result: CustomObjectType = { id, name: string(type.name, `${path}.name`), symbol, description: optionalText(type.description, `${path}.description`), shape: shape as ObjectType };
    if (type.model !== undefined) {
      const model = record(type.model, `${path}.model`);
      const rotation = model.rotation === undefined ? [0, 0, 0] : array(model.rotation, `${path}.model.rotation`, 3);
      if (rotation.length !== 3) throw Error(`${path}.model.rotation must contain three angles in degrees.`);
      result.model = { url: validateModelUrl(model.url, `${path}.model.url`), rotation: rotation.map((angle, j) => number(angle, `${path}.model.rotation[${j}]`, 0, -360, 360)) as [number, number, number] };
    }
    return result;
  });
  unique(objectTypes.map(type => type.id), 'objectTypes');
  const planes = array(value.planes === undefined ? [{ id: 'default', name: 'Default plane' }] : value.planes, 'planes', 50).map((entry, i) => {
    const plane = record(entry, `planes[${i}]`);
    const decoration = record(plane.decoration === undefined ? {} : plane.decoration, `planes[${i}].decoration`);
    const sizing = plane.sizing === undefined ? 'auto' : plane.sizing;
    if (sizing !== 'auto' && sizing !== 'locked') throw Error(`planes[${i}].sizing must be auto or locked.`);
    return {
      id: string(plane.id, `planes[${i}].id`), name: string(plane.name, `planes[${i}].name`),
      width: number(plane.width, `planes[${i}].width`, 20, 1, 10000),
      height: number(plane.height, `planes[${i}].height`, 20, 1, 10000),
      elevation: validateElevation(plane.elevation, `planes[${i}].elevation`),
      sizing: sizing as 'auto' | 'locked',
      decoration: {
        color: color(decoration.color, `planes[${i}].decoration.color`, presentation.accent),
        opacity: number(decoration.opacity, `planes[${i}].decoration.opacity`, 0.025, 0, 1),
        border: boolean(decoration.border, `planes[${i}].decoration.border`, true),
        grid: boolean(decoration.grid, `planes[${i}].decoration.grid`, false),
        label: boolean(decoration.label, `planes[${i}].decoration.label`, true),
      },
    };
  });
  unique(planes.map(plane => plane.id), 'planes');
  const planeIds = new Set(planes.map(plane => plane.id));
  const groups = array(value.groups, 'groups', 50).map((entry, i) => {
    const g = record(entry, `groups[${i}]`);
    const plane = string(g.plane, `groups[${i}].plane`, planes[0]?.id);
    if (!planeIds.has(plane)) throw Error(`groups[${i}].plane references unknown plane "${plane}".`);
    return { id: string(g.id, `groups[${i}].id`), name: string(g.name, `groups[${i}].name`), color: color(g.color, `groups[${i}].color`, palette[i % palette.length]), elevation: validateElevation(g.elevation, `groups[${i}].elevation`), plane };
  });
  unique(groups.map(g => g.id), 'groups');
  const groupIds = new Set(groups.map(g => g.id));
  const objects = array(value.objects, 'objects', 500).map((entry, i) => {
    const o = record(entry, `objects[${i}]`);
    const group = string(o.group, `objects[${i}].group`);
    if (!groupIds.has(group)) throw Error(`objects[${i}].group references unknown group "${group}".`);
    const type = string(o.type, `objects[${i}].type`, 'container');
    if (!isKnownType(type, objectTypes)) warnings.push(`Object "${String(o.name)}": unknown type "${type}"; displayed as Container.`);
    return { id: string(o.id, `objects[${i}].id`), name: string(o.name, `objects[${i}].name`), group, type, description: optionalText(o.description, `objects[${i}].description`), elevation: validateElevation(o.elevation, `objects[${i}].elevation`) };
  });
  unique(objects.map(o => o.id), 'objects');
  const objectIds = new Set(objects.map(o => o.id));
  function endpoint(value: unknown, path: string): ConnectionEndpoint {
    if (typeof value === 'string') {
      if (!objectIds.has(value)) throw Error(`${path} references an unknown object.`);
      return value;
    }
    const ref = record(value, path);
    const id = string(ref.id, `${path}.id`);
    if (ref.kind !== 'plane' && ref.kind !== 'group' && ref.kind !== 'object') throw Error(`${path}.kind must be plane, group, or object.`);
    const ids = ref.kind === 'plane' ? planeIds : ref.kind === 'group' ? groupIds : objectIds;
    if (!ids.has(id)) throw Error(`${path} references an unknown ${ref.kind}.`);
    return { kind: ref.kind, id };
  }
  const connections = array(value.connections ?? [], 'connections', 2000).map((entry, i) => {
    const c = record(entry, `connections[${i}]`);
    const from = endpoint(c.from, `connections[${i}].from`);
    const to = endpoint(c.to, `connections[${i}].to`);
    if (endpointKey(from) === endpointKey(to)) throw Error(`connections[${i}] connects an entity to itself; self-connections are not supported in v1.`);
    const direction = c.direction === undefined ? 'forward' : c.direction;
    if (direction !== 'forward' && direction !== 'bidirectional') throw Error(`connections[${i}].direction must be forward or bidirectional.`);
    return { id: string(c.id, `connections[${i}].id`), from, to, label: optionalText(c.label, `connections[${i}].label`), direction: direction as 'forward' | 'bidirectional' };
  });
  unique(connections.map(c => c.id), 'connections');
  const config: ArchitectureConfig = { schemaVersion: 1, presentation, view, objectTypes, planes, groups, objects, connections };
  return { config, warnings };
}

export function parseConfig(text: string): ValidationResult {
  if (text.length > 2_000_000) throw Error('Configuration must be smaller than 2 MB.');
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw Error('Invalid JSON. Check commas, quotes, and brackets.'); }
  return validateConfig(input);
}
