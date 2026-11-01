import { parseConfig } from './validate';
import type { ArchitectureConfig } from './types';

const STORAGE_KEY = 'dimentionalizer.config.v1';
export function loadSaved(): { config?: ArchitectureConfig; notice?: string } {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return {};
    const result = parseConfig(text);
    return { config: result.config, notice: result.warnings.join(' ') || undefined };
  } catch { return { notice: 'The saved configuration could not be loaded. Showing the default example.' }; }
}
export function saveConfig(config: ArchitectureConfig): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); return true; } catch { return false; }
}
