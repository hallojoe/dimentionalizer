/** Hosted assets survive export; session-only blob/file URLs do not. */
export function validateModelUrl(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value || value.length > 2000 || /[\s\\?#]/.test(value)) {
    throw Error(`${path} must be a relative asset path or HTTPS URL ending in .glb or .gltf.`);
  }
  const remote = value.startsWith('https://');
  if (!remote && (value.startsWith('/') || value.includes(':') || value.split('/').some(part => !part || part === '..' || part === '.'))) {
    throw Error(`${path} must be a relative asset path without traversal, or an HTTPS URL.`);
  }
  const url = new URL(value, 'https://model.invalid/');
  if ((remote && (url.username || url.password)) || !/\.(glb|gltf)$/i.test(url.pathname) || /%2e|%2f|%5c/i.test(value)) {
    throw Error(`${path} must point to a .glb or .gltf asset without credentials or encoded traversal.`);
  }
  return value;
}

export function resolveModelUrl(url: string, base: string): string {
  return new URL(url, base).href;
}
