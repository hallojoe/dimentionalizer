import type { ArchitectureConfig } from './types';

export const presentationDefaults: ArchitectureConfig['presentation'] = {
  title: 'Dimentionalizer — Structure explorer',
  brand: 'Dimentionalizer',
  eyebrow: 'CONNECTED STRUCTURES',
  headline: 'Give your systems\na new dimension.',
  description: 'Explore the building blocks. Follow the connections. See how it all fits together.',
  accent: '#b8ff6c',
  background: '#090f14',
};
export const viewBooleanDefaults = { showNames: true, effects: true, autoOrbit: false, showGrid: true, showPlaneFrames: true, showGroupFrames: true };
export const palette = ['#b8ff6c', '#61d8ee', '#b9a0ff', '#ffb16c', '#f488b5', '#77ebc4'];

export const viewDefaults: ArchitectureConfig['view'] = { ...viewBooleanDefaults, modelTheme: 'wire' };
