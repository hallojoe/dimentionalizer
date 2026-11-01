/** The only catalog of semantic object types. Rendering is registered separately. */
export const objectCatalog = [
  { id: 'container', name: 'Container', symbol: '▤', description: 'The universal building block. Use it for anything without a specialized type.' },
  { id: 'database', name: 'Database', symbol: '▱', description: 'A persistent, structured data store.' },
  { id: 'email', name: 'E-mail', symbol: '✉', description: 'A component that sends, receives, or processes e-mail.' },
  { id: 'cache', name: 'Cache', symbol: 'ϟ', description: 'Fast, temporary storage close to the application.' },
  { id: 'reverse-proxy', name: 'Reverse proxy', symbol: '⇄', description: 'An entry point forwarding requests to upstream services.' },
  { id: 'queue', name: 'Queue', symbol: '≡', description: 'An ordered buffer for asynchronous work or messages.' },
  { id: 'storage', name: 'Storage', symbol: '▥', description: 'Files, objects, or volumes held for later use.' },
  { id: 'cdn', name: 'CDN', symbol: '◇', description: 'A distributed network delivering content closer to its users.' },
] as const;

export type ObjectType = (typeof objectCatalog)[number]['id'];
export function resolveType(type?: string): (typeof objectCatalog)[number] {
  return objectCatalog.find(entry => entry.id === type) ?? objectCatalog[0];
}
export function isKnownType(type: string): boolean {
  return objectCatalog.some(entry => entry.id === type);
}
