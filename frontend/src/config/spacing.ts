import type { Spacing, SpacedEntity } from './types';

/** Optional spacing is kept absent, so explicit zero can override inherited spacing. */
export function validateSpacing(value: unknown, path: string, hasChildren = true): SpacedEntity {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${path} must be an object.`);
  const raw = value as Record<string, unknown>;
  const mode = raw.mode === undefined ? 'margin' : raw.mode, target = raw.target === undefined ? 'self' : raw.target;
  if (mode !== 'margin' && mode !== 'padding') throw Error(`${path}.mode must be margin or padding.`);
  if (target !== 'self' && target !== 'children') throw Error(`${path}.target must be self or children.`);
  if (!hasChildren && target === 'children') throw Error(`${path}.target must be self: objects do not own layout children.`);
  if (typeof raw.value !== 'number' || !Number.isFinite(raw.value) || raw.value < 0 || raw.value > 1000) throw Error(`${path}.value must be a number between 0 and 1000.`);
  return { spacing: { mode, target, value: raw.value } };
}

/** Direct-child defaults stop at the next level and never cross a space portal. */
export function resolveSpacing(entity: SpacedEntity, parent?: SpacedEntity): { margin: number; padding: number; inherited: boolean; rule?: Spacing } {
  const inherited = entity.spacing === undefined && parent?.spacing?.target === 'children';
  const rule = entity.spacing?.target === 'self' ? entity.spacing : inherited ? parent!.spacing : undefined;
  return { margin: rule?.mode === 'margin' ? rule.value : 0, padding: rule?.mode === 'padding' ? rule.value : 0, inherited, rule };
}
