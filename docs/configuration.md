# Configuration reference

The deployed default is `frontend/public/architecture.json`. The app fetches it at startup, then applies a valid browser-local override if present. The startup document must be valid even when a local override exists.

Start with `frontend/public/examples/minimal.json`. `architecture.schema.json` can be associated with your JSON in an editor; runtime validation is authoritative for unique IDs and cross-references.

```json
{
  "schemaVersion": 1,
  "presentation": {
    "title": "My system — Architecture",
    "brand": "My system",
    "eyebrow": "SERVICE MAP",
    "headline": "Inside my system.",
    "description": "Select an object to discover its role.",
    "accent": "#b8ff6c",
    "background": "#090f14"
  },
  "view": { "showNames": true, "effects": true, "autoOrbit": false },
  "groups": [{ "id": "core", "name": "Core", "color": "#61d8ee" }],
  "objects": [
    { "id": "app", "name": "Application", "group": "core", "description": "Handles requests." },
    { "id": "db", "name": "Database", "group": "core", "type": "database" }
  ],
  "connections": [{ "id": "app-db", "from": "app", "to": "db", "label": "Read / write" }]
}
```

## Fields

| Field | Rules |
| --- | --- |
| `schemaVersion` | Required; exactly `1` |
| `presentation` | Optional; omitted fields use neutral product defaults |
| `presentation.title` | Browser tab title |
| `presentation.brand` | Brand text in the header; no hard-coded organization |
| `presentation.eyebrow` | Small introduction label |
| `presentation.headline` | Main heading; `\n` produces a line break |
| `presentation.description` | Introduction and HTML description metadata |
| `presentation.accent`, `background` | Six-digit hex colors; group colors are independent |
| `view` | Optional boolean settings; reduced-motion preference suppresses automatic motion |
| `groups` | Required array, up to 50 entries; empty groups are allowed |
| Group `id`, `name` | Required non-empty strings; group IDs must be unique |
| Group `color` | Optional hex color; default palette follows group order |
| `objects` | Required array, up to 500 entries; an empty architecture is allowed |
| Object `id`, `name`, `group` | Required; `group` must match a group ID; object IDs must be unique |
| Object `type` | Optional; defaults to `container`; unknown types are retained and displayed as Container |
| Object `description` | Optional plain text, supports line breaks |
| `connections` | Optional array, up to 2,000 directed edges |
| Connection `id`, `from`, `to` | Required; IDs must be unique; endpoints must exist; no self-connections in v1 |
| Connection `label` | Optional plain-text relationship description |

Text values are limited to 10,000 characters and imported documents to 2 MB. A large valid architecture can still need a capable device; rendering limits are ceilings, not performance guarantees.

Types use these exact IDs: `container`, `database`, `email`, `cache`, `reverse-proxy`, `queue`, `storage`, `cdn`. Names do not determine type. A component named "Database" with no `type` is still a generic container.

Duplicate display names are allowed. Stable IDs keep relationships unambiguous. Connections are directed from `from` to `to`; the inspector lists the direction and label. Animated particles travel along that direction. These particles illustrate the configuration and do not represent traffic measurements.

## Validation and persistence

The editor validates the entire document before applying any changes. Invalid JSON, bad colors, duplicate IDs, unsupported schema versions, and broken references leave the current architecture untouched. Unknown object types are a warning, not an error. Export emits a normalized document containing defaults.

The application stores configuration in localStorage for the current origin. It catches blocked storage and quota errors and offers export as the durable alternative. Browser changes never write to the default JSON file. **Load default** restores the startup file into the editor; **Apply configuration** commits that draft locally.

Unknown fields are ignored and removed during normalization/export. Do not store decorators or other important extension data in a v1 document yet.

## Legacy migration

An imported array of `{ "name": "API", "group": "Services", "text": "Description" }` records is accepted. It becomes a v1 document with generated `object-1`, `object-2`, … IDs, one group per distinct group name, and all types set to Container. No connections are invented. Export once to retain the new document format and IDs.

## Security and privacy

The viewer does not execute HTML or scripts from configuration: display text is inserted with DOM `textContent`. No analytics or server persistence are included. The example contains fictional, generic architecture. Use appropriate access controls on your hosting if your configuration describes a private system.
