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
| `view.showGrid` | Show/hide the world ground grid; defaults to `true`; does not hide group platforms |
| `groups` | Required array, up to 50 entries; empty groups are allowed |
| Group `id`, `name` | Required non-empty strings; group IDs must be unique |
| Group `color` | Optional hex color; default palette follows group order |
| Group `elevation` | Signed height relative to world zero; defaults to `0` |
| `objects` | Required array, up to 500 entries; an empty architecture is allowed |
| Object `id`, `name`, `group` | Required; `group` must match a group ID; object IDs must be unique |
| Object `type` | Optional; defaults to `container`; unknown types are retained and displayed as Container |
| Object `description` | Optional plain text, supports line breaks |
| Object `elevation` | Signed offset relative to its group plane; defaults to `0` |
| `connections` | Optional array, up to 2,000 directed edges |
| Connection `id`, `from`, `to` | Required; IDs must be unique; endpoints must exist; no self-connections in v1 |
| Connection `label` | Optional plain-text relationship description |

Text values are limited to 10,000 characters and imported documents to 2 MB. A large valid architecture can still need a capable device; rendering limits are ceilings, not performance guarantees.

Types use these exact IDs: `container`, `database`, `email`, `cache`, `reverse-proxy`, `queue`, `storage`, `cdn`. Names do not determine type. A component named "Database" with no `type` is still a generic container.

Duplicate display names are allowed. Stable IDs keep relationships unambiguous. Connections are directed from `from` to `to`; the inspector lists the direction and label. Animated particles travel along that direction. These particles illustrate the configuration and do not represent traffic measurements.

## Elevation and the grid

Select a group in the directory to edit **Group elevation**, or select an object to edit both **Group elevation** and **Item elevation** in its inspector. Enter a number, then press Enter or leave the field to apply it. Each field has a **Reset** button that returns that value to `0`.

- `0` is the baseline, `10` is above, and `-10` is below. Fractional values are supported.
- Group elevation moves the group's platform and every member together.
- Item elevation is relative to its group: group `10` plus item `-10` gives combined elevation `0`; group `-10` plus item `-10` gives `-20`.
- Labels, connection endpoints, hit targets, and camera focus follow elevation. The original small object-to-platform rendering clearance is retained.
- Elevations must be finite numbers from `-10000` to `10000` scene units. Invalid input does not change the saved configuration.

The **Grid** button in the view controls toggles the ground reference grid independently of the group platforms. The grid stays at the world's zero baseline. Both elevations and `view.showGrid` are saved locally and included in JSON exports. **Reset view** changes the camera and filters; it does not reset elevation or grid preferences. Older configurations and presets with these fields omitted remain valid and default to elevation `0` and a visible grid.

```json
{
  "schemaVersion": 1,
  "view": { "showGrid": false },
  "groups": [{ "id": "core", "name": "Core", "elevation": 10 }],
  "objects": [
    { "id": "api", "name": "API", "group": "core", "elevation": 0 },
    { "id": "db", "name": "Database", "group": "core", "type": "database", "elevation": -10 }
  ]
}
```

## Validation and persistence

The editor validates the entire document before applying any changes. Invalid JSON, bad colors, duplicate IDs, unsupported schema versions, and broken references leave the current architecture untouched. Unknown object types are a warning, not an error. Export emits a normalized document containing defaults.

The application stores configuration in localStorage for the current origin. It catches blocked storage and quota errors and offers export as the durable alternative. Browser changes never write to the default JSON file. **Load default** restores the startup file into the editor; **Apply configuration** commits that draft locally.

Unknown fields are ignored and removed during normalization/export. Do not store decorators or other important extension data in a v1 document yet.

## Legacy migration

An imported array of `{ "name": "API", "group": "Services", "text": "Description" }` records is accepted. It becomes a v1 document with generated `object-1`, `object-2`, … IDs, one group per distinct group name, and all types set to Container. No connections are invented. Export once to retain the new document format and IDs.

## Security and privacy

The viewer does not execute HTML or scripts from configuration: display text is inserted with DOM `textContent`. No analytics or server persistence are included. The example contains fictional, generic architecture. Use appropriate access controls on your hosting if your configuration describes a private system.
