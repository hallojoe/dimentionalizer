import manifest from '../../public/presets/index.json';
import { parseConfig } from '../config/validate';
import type { ArchitectureConfig } from '../config/types';

export interface PresetDefinition {
  id: string;
  name: string;
  summary: string;
  category: string;
  groups: number;
  objects: number;
  connections: number;
  source?: { label: string; url: string; revision: string };
}

/** Metadata is bundled; full documents are fetched only when selected. */
export const presetCatalog: readonly PresetDefinition[] = manifest;
type Fetcher = (url: string, options?: RequestInit) => Promise<Response>;

export async function loadPreset(
  id: string,
  baseUrl: string,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<ArchitectureConfig> {
  const preset = presetCatalog.find(entry => entry.id === id);
  if (!preset) throw Error('Unknown architecture preset.');
  const response = await fetcher(`${baseUrl.replace(/\/?$/, '/')}presets/${preset.id}.json`, { signal });
  if (!response.ok) throw Error(`Could not load ${preset.name} (${response.status}). Please try again.`);
  const result = parseConfig(await response.text());
  if (result.warnings.length) throw Error(`Preset needs updating: ${result.warnings.join(' ')}`);
  return result.config;
}
