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
| `view` | Optional display settings; reduced-motion preference suppresses automatic motion |
| `view.modelTheme` | `wire` (default) or `textured`; see [3D model themes](model-themes.md) |
| `view.showGrid` | Show/hide the world ground grid; defaults to `true`; does not hide group platforms |
| `view.showPlaneFrames`, `view.showGroupFrames` | Global frame visibility; each defaults to `true`; leaves contents and connectors visible |
| Plane, group, or object `visible` | Optional boolean, default `true`; hidden parents also hide descendants; see [visibility](visibility.md) |
| Plane or group `showFrame` | Optional boolean, default `true`; hides only its surface, border, grid, and heading |
| Entity `spacing` | Optional on spaces, planes, groups, and objects; see [spacing and overrides](spacing.md) |
| `spaces` | Optional array of 1–50 spaces; omitted creates Main space; each needs unique `id` and `name` |
| `spaceView` | Optional `{ visible: [space IDs], active: space ID or null }`; defaults to all spaces in combined view |
| `objectTypes` | Optional array of up to 50 custom type definitions; see [object types and models](object-types.md) |
| `planes` | Optional array, up to 50 entries; omitted creates one default auto-fit plane at world zero |
| Plane fields | See **Planes** below |
| `groups` | Required array, up to 50 entries; empty groups are allowed |
| Group `id`, `name` | Required non-empty strings; group IDs must be unique |
| Group `color` | Optional hex color; default palette follows group order |
| Group `plane` | Parent plane ID; omitted uses the first plane |
| Group `elevation` | Signed height relative to its parent plane; defaults to `0` |
| `objects` | Required array, up to 500 entries; an empty architecture is allowed |
| Object `id`, `name`, `group` | Required; `group` must match a group ID; object IDs must be unique |
| Object `checklist` | Optional array of up to 20 `{ id, text, done? }` items; IDs unique per object; `done` defaults to false |
| Object `linkedSpace` | Optional portal target; must be another existing space; clicking pans there and keeps the inspector |
| Object `type` | Optional; defaults to `container`; built-in or custom type ID; unknown types are retained and displayed as Container |
| Object `description` | Optional plain text, supports line breaks |
| Object `elevation` | Signed offset relative to its group; defaults to `0` |
| `connections` | Optional array, up to 2,000 edges |
| Connection `id`, `from`, `to` | Required; IDs must be unique; endpoints must exist; no self-connections in v1 |
| Connection `flow` | Optional per-direction model IDs, size, duration, and pause; see [connection models](connection-models.md) |
| Connection `style` | `normal` (default), `lightning`, or `wobbly` |
| Connection `capacity` | Optional `{ out?, in?, unit? }`; see [spaces and connector guide](spaces.md) |
| Connection `direction` | `forward` (default) or `bidirectional` |
| Connection `label` | Optional plain-text relationship description |

Text values are limited to 10,000 characters and imported documents to 2 MB. A large valid architecture can still need a capable device; rendering limits are ceilings, not performance guarantees.

Built-in types cover infrastructure, people, business entities, and workflow steps. See the complete [type catalog and custom model contract](object-types.md). Add `objectTypes` to define a custom meaning that reuses a shape or loads a self-contained glTF/GLB asset. Names do not determine type: a component named "Database" with no `type` is still a generic container.

Duplicate display names are allowed. Stable IDs keep relationships unambiguous. Connections default to one-way from `from` to `to`. Set `direction: "bidirectional"` to animate two models traveling in opposite directions. Every entity inspector lists its connections and lets you change their direction. These models illustrate the configuration and do not represent traffic measurements.

## Spaces

See [spaces, portals, and capacity](spaces.md) for the creation controls, combined views, navigation behavior, duplication rules, and configuration example. Each plane belongs to a space; existing plane/group/item semantics are retained. IDs remain unique across the whole document within each entity kind.

## Planes

Planes are an additional level above groups. Each group belongs to exactly one plane through `group.plane`; objects still belong to groups. Existing documents and the original eight presets work without modification: omitting `planes` creates a default auto-fit plane at elevation `0`. With explicit planes, groups without a `plane` use the first entry. Plane IDs must be unique within the plane catalog; group and object IDs have their own namespaces.

| Plane field | Meaning and default |
| --- | --- |
| `space` | Parent space ID; omitted uses the first space |
| `id`, `name` | Required stable ID and display name |
| `width`, `height` | Horizontal X/Z footprint in scene units; each defaults to `20`, valid from `1` to `10000` |
| `elevation` | Height above world zero; defaults to `0` |
| `sizing` | `auto` (default) or `locked` |
| `decoration.color` | Six-digit hex color; defaults to presentation accent |
| `decoration.opacity` | Surface opacity from `0` to `1`; defaults to `0.025` |
| `decoration.border` | Show outline; defaults to `true` |
| `decoration.grid` | Show this plane's finite grid; defaults to `false` |
| `decoration.label` | Show this plane's scene label; defaults to `true` |

**Auto-fit** grows around all group footprints with padding. Configured width and height are minimum dimensions. **Locked** uses the exact dimensions; overflowing groups remain visible at their original size, and the directory and plane inspector show a warning. Neighboring planes reserve space for overflowing content so it does not overlap another plane. Planes and groups are automatically arranged horizontally; manual X/Z positioning is not part of this addition.

Define planes in **Configure**, then select a plane in the directory and choose **Inspect plane & connections** to edit its size mode, dimensions, elevation, and decoration. Select a group and choose **Inspect group & connections** to change its parent plane. Moving a group retains its relative elevation, so its world elevation changes with its new parent.

Import [`frontend/public/examples/planes.json`](../frontend/public/examples/planes.json) for a complete three-plane example with locked and auto-fit sizes, positive and negative elevation, and connections at every level.

## Elevation and grids

The world (spacetime) is the absolute reference with zero elevation. Each level adds an offset to its parent:

`item world elevation = plane elevation + group elevation + item elevation`

- `0` is the parent's baseline, `10` is above, and `-10` is below. Fractional values are supported.
- Plane elevation moves every group and item on the plane together.
- Group elevation moves its platform and all its items relative to the plane.
- Item elevation is relative to its group. Plane `10`, group `-3`, and item `-2` give world elevation `5`.
- Labels, connection endpoints, hit targets, and camera focus follow the combined elevation. Small surface and object rendering clearances remain purely visual.
- Each elevation must be a finite number from `-10000` to `10000` scene units. Invalid input does not change the saved configuration.

Use the plane, group, or object inspector to edit elevation. Enter a number, then press Enter or leave the field to apply it. Each elevation field has a **Reset** button that returns that offset to `0`.

The **Grid** view button toggles the world reference grid at zero. Each plane has its own independent `decoration.grid` setting. All settings persist locally and export to JSON. **Reset view** changes the camera and filters; it does not reset elevation, dimensions, decoration, or grid preferences.

```json
{
  "schemaVersion": 1,
  "planes": [
    { "id": "application", "name": "Application plane", "elevation": 10 },
    { "id": "data", "name": "Data plane", "width": 30, "height": 25,
      "elevation": -10, "sizing": "locked", "decoration": { "grid": true } }
  ],
  "groups": [
    { "id": "services", "name": "Services", "plane": "application", "elevation": -3 },
    { "id": "persistence", "name": "Persistence", "plane": "data" }
  ],
  "objects": [
    { "id": "api", "name": "API", "group": "services", "elevation": -2 },
    { "id": "db", "name": "Database", "group": "persistence", "type": "database" }
  ],
  "connections": [
    { "id": "planes", "from": { "kind": "plane", "id": "application" },
      "to": { "kind": "plane", "id": "data" }, "direction": "bidirectional" },
    { "id": "api-db", "from": "api", "to": "db", "direction": "forward" }
  ]
}
```

## Connection endpoints and direction

A string endpoint remains shorthand for an object ID, preserving existing documents. Typed endpoints use `{ "kind": "space" | "plane" | "group" | "object", "id": "..." }`. Any combination is supported, including space-to-object, plane-to-plane, group-to-group, object-to-object, and mixed levels. The referenced entity must exist. Self-connections are rejected, including a shorthand object linked to its equivalent typed reference.

`direction: "forward"` animates a model from `from` to `to`; `"bidirectional"` adds a model traveling back. Each grows and fades in at the source, then shrinks and fades out at arrival. See [connection models](connection-models.md) for model selection, timing, and examples. To reverse a one-way connection, swap its endpoints in Configure. The Effects toggle hides moving models without hiding connection lines. Reduced-motion preference shows stationary models. These effects describe the document rather than measured traffic.

## Validation and persistence

The editor validates the entire document before applying any changes. Invalid JSON, bad colors, duplicate IDs, unsupported schema versions, and broken references leave the current architecture untouched. Unknown object types are a warning, not an error. Export emits a normalized document containing defaults.

The application stores configuration in localStorage for the current origin. It catches blocked storage and quota errors and offers export as the durable alternative. Browser changes never write to the default JSON file. **Load default** restores the startup file into the editor; **Apply configuration** commits that draft locally.

Unknown fields are ignored and removed during normalization/export. Do not store decorators or other important extension data in a v1 document yet.

## Legacy migration

An imported array of `{ "name": "API", "group": "Services", "text": "Description" }` records is accepted. It becomes a v1 document with generated `object-1`, `object-2`, … IDs, one group per distinct group name, and all types set to Container. No connections are invented. Export once to retain the new document format and IDs.

## Security and privacy

The viewer does not execute HTML or scripts from configuration: display text is inserted with DOM `textContent`. No analytics or server persistence are included. Examples contain fictional structures. Custom model URLs trigger browser asset requests; JSON exports reference these files without embedding them. Use appropriate access controls on your hosting if your configuration describes a private system.
