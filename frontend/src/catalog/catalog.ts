import type { CustomObjectType } from '../config/types';

/** Built-in meanings; a custom type can reuse any built-in shape. */
export const objectCatalog = [
  { id: 'container', name: 'Container', symbol: '▤', description: 'The universal building block. Use it for anything without a specialized type.' },
  { id: 'database', name: 'Database', symbol: '▱', description: 'A persistent, structured data store.' },
  { id: 'key', name: 'Key / Login', symbol: '⚿', description: 'A key representing access, credentials, authentication, or permission.' },
  { id: 'email', name: 'E-mail', symbol: '✉', description: 'A component that sends, receives, or processes e-mail.' },
  { id: 'cache', name: 'Cache', symbol: 'ϟ', description: 'Fast, temporary storage close to the application.' },
  { id: 'reverse-proxy', name: 'Reverse proxy', symbol: '⇄', description: 'An entry point forwarding requests to upstream services.' },
  { id: 'queue', name: 'Queue', symbol: '≡', description: 'An ordered buffer for asynchronous work or messages.' },
  { id: 'storage', name: 'Storage', symbol: '▥', description: 'Files, objects, or volumes held for later use.' },
  { id: 'cdn', name: 'CDN', symbol: '◇', description: 'A distributed network delivering content closer to its users.' },
  { id: 'user', name: 'User', symbol: '♙', description: 'A person, customer, member, or other individual actor.' },
  { id: 'usergroup', name: 'User group', symbol: '♟', description: 'A team, audience, role, or collection of people. This is an object, separate from layout groups.' },
  { id: 'event', name: 'Event', symbol: '◷', description: 'Something that happened, a scheduled occasion, or a domain event.' },
  { id: 'product', name: 'Product', symbol: '⬡', description: 'An offering, catalog item, or physical or digital product.' },
  { id: 'shop', name: 'Shop', symbol: '▧', description: 'A storefront, marketplace, or point of sale.' },
  { id: 'warehouse', name: 'Warehouse', symbol: '⌂', description: 'A physical fulfillment or inventory location. Use Database for an analytical data warehouse.' },
  { id: 'workflow', name: 'Workflow', symbol: '⤳', description: 'A coordinated sequence of steps, branches, and handoffs.' },
  { id: 'request', name: 'Request', symbol: '→', description: 'An incoming command, query, or request for work.' },
  { id: 'response', name: 'Response', symbol: '←', description: 'A result, acknowledgement, or reply to a request.' },
  { id: 'processing', name: 'Processing', symbol: '⚙', description: 'A transformation, calculation, decision, or work step.' },
  { id: 'webhook', name: 'Webhook', symbol: '↪', description: 'An event notification delivered to an HTTP endpoint.' },
  { id: 'api-call', name: 'API call', symbol: '⇄', description: 'An invocation of an external or internal API.' },
  { id: 'dataflow', name: 'Dataflow', symbol: '⋯', description: 'A stream, batch, or transfer of data between steps.' },
  { id: 'message', name: 'Message', symbol: '▢', description: 'A chat message or channel notification, such as a Slack message.' },
  { id: 'human', name: 'Human', symbol: '♙', description: 'A person in an everyday situation.' },
  { id: 'family', name: 'Family', symbol: '♟', description: 'A household or family represented as an object.' },
  { id: 'adult', name: 'Adult', symbol: '♙', description: 'An adult person or household member.' },
  { id: 'child', name: 'Child', symbol: '♙', description: 'A child person or household member.' },
  { id: 'food', name: 'Food', symbol: '◉', description: 'A meal, groceries, or food supplies.' },
  { id: 'bed', name: 'Bed', symbol: '▰', description: 'A place to sleep or rest.' },
  { id: 'shower', name: 'Shower', symbol: '⋮', description: 'A shower or bathing facility.' },
  { id: 'toilet', name: 'Toilet', symbol: '◡', description: 'A toilet or restroom fixture.' },
  { id: 'sofa', name: 'Sofa', symbol: '▰', description: 'Shared seating in a living or waiting area.' },
  { id: 'chair', name: 'Chair', symbol: '▧', description: 'An individual seat.' },
  { id: 'desk', name: 'Desk', symbol: '▤', description: 'A work or study surface.' },
  { id: 'wall', name: 'Wall', symbol: '▥', description: 'A solid partition or boundary.' },
  { id: 'window-wall', name: 'Window wall', symbol: '⊞', description: 'A glazed wall or window partition.' },
  { id: 'bus', name: 'Bus', symbol: '▣', description: 'A road vehicle for shared passenger transport.' },
  { id: 'train', name: 'Train', symbol: '▤', description: 'A rail vehicle or train service.' },
  { id: 'airplane', name: 'Airplane', symbol: '✈', description: 'An aircraft or flight service.' },
  { id: 'office', name: 'Office', symbol: '▦', description: 'An office building, workplace, or room.' },
  { id: 'home', name: 'Home', symbol: '⌂', description: 'A home that can open a linked interior space.' },
] as const;

export type ObjectType = (typeof objectCatalog)[number]['id'];
export interface ResolvedObjectType {
  id: string; name: string; symbol: string; description: string;
  shape: ObjectType;
  model?: CustomObjectType['model'];
  custom: boolean;
}
export function getObjectCatalog(customTypes: readonly CustomObjectType[] = []): ResolvedObjectType[] {
  return [
    ...objectCatalog.map(entry => ({ ...entry, shape: entry.id, custom: false })),
    ...customTypes.map(entry => ({ ...entry, custom: true })),
  ];
}
export function resolveType(type?: string, customTypes: readonly CustomObjectType[] = []): ResolvedObjectType {
  return getObjectCatalog(customTypes).find(entry => entry.id === type) ?? { ...objectCatalog[0], shape: 'container', custom: false };
}
export function isKnownType(type: string, customTypes: readonly CustomObjectType[] = []): boolean {
  return objectCatalog.some(entry => entry.id === type) || customTypes.some(entry => entry.id === type);
}
