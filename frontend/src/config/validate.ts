import { isKnownType } from '../catalog/catalog';
import { palette, presentationDefaults, viewDefaults } from './defaults';
import type { ArchitectureConfig, ValidationResult } from './types';
import { validateElevation } from './elevation';

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
  const groups = array(value.groups, 'groups', 50).map((entry, i) => {
    const g = record(entry, `groups[${i}]`);
    return { id: string(g.id, `groups[${i}].id`), name: string(g.name, `groups[${i}].name`), color: color(g.color, `groups[${i}].color`, palette[i % palette.length]), elevation: validateElevation(g.elevation, `groups[${i}].elevation`) };
  });
  unique(groups.map(g => g.id), 'groups');
  const groupIds = new Set(groups.map(g => g.id));
  const objects = array(value.objects, 'objects', 500).map((entry, i) => {
    const o = record(entry, `objects[${i}]`);
    const group = string(o.group, `objects[${i}].group`);
    if (!groupIds.has(group)) throw Error(`objects[${i}].group references unknown group "${group}".`);
    const type = string(o.type, `objects[${i}].type`, 'container');
    if (!isKnownType(type)) warnings.push(`Object "${String(o.name)}": unknown type "${type}"; displayed as Container.`);
    return { id: string(o.id, `objects[${i}].id`), name: string(o.name, `objects[${i}].name`), group, type, description: optionalText(o.description, `objects[${i}].description`), elevation: validateElevation(o.elevation, `objects[${i}].elevation`) };
  });
  unique(objects.map(o => o.id), 'objects');
  const objectIds = new Set(objects.map(o => o.id));
  const connections = array(value.connections ?? [], 'connections', 2000).map((entry, i) => {
    const c = record(entry, `connections[${i}]`);
    const from = string(c.from, `connections[${i}].from`);
    const to = string(c.to, `connections[${i}].to`);
    if (!objectIds.has(from) || !objectIds.has(to)) throw Error(`connections[${i}] references an unknown object.`);
    if (from === to) throw Error(`connections[${i}] connects an object to itself; self-connections are not supported in v1.`);
    return { id: string(c.id, `connections[${i}].id`), from, to, label: optionalText(c.label, `connections[${i}].label`) };
  });
  unique(connections.map(c => c.id), 'connections');
  const config: ArchitectureConfig = { schemaVersion: 1, presentation, view, groups, objects, connections };
  return { config, warnings };
}

export function parseConfig(text: string): ValidationResult {
  if (text.length > 2_000_000) throw Error('Configuration must be smaller than 2 MB.');
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw Error('Invalid JSON. Check commas, quotes, and brackets.'); }
  return validateConfig(input);
}
