# Objects and custom types

An object can represent a person, place, product, event, action, data stream, service, or anything else. Its `type` describes its meaning; the catalog supplies its name, symbol, and appearance. Layout groups and planes organize objects independently of their type. A User group object represents a team or audience; it does not create a layout group.

## Built-in catalog

| Category | Type IDs |
| --- | --- |
| General | `container` |
| Infrastructure | `database`, `key`, `email`, `cache`, `reverse-proxy`, `queue`, `storage`, `cdn` |
| People and business | `user`, `usergroup`, `event`, `product`, `shop`, `warehouse` |
| Everyday people | `human`, `family`, `adult`, `child` |
| Home and furniture | `home`, `food`, `bed`, `shower`, `toilet`, `sofa`, `chair`, `desk`, `wall`, `window-wall` |
| Travel and work | `bus`, `train`, `airplane`, `office` |
| Workflows and communication | `workflow`, `request`, `response`, `processing`, `webhook`, `api-call`, `dataflow`, `message` |

Use `key` for login, access, or credentials, including as a moving connection model. Use `email` for a Send e-mail step and `message` for a Slack or chat notification. `warehouse` depicts a physical location; an analytical data warehouse can use `database`. Labels and descriptions provide the context. These are visual model elements: they do not execute workflows, make API calls, send e-mails, or post Slack messages. Animated connection models illustrate direction rather than live execution or measured traffic.

The object inspector has an **Object type** selector. The catalog, inspector, search, and type filter include configured custom types. Omitted types default to Container. An unregistered type preserves its ID and renders as Container with a validation warning.

## Define your own vocabulary

Add `objectTypes` in Configure, or edit the deployment's `architecture.json`. No application code is needed. The catalog is part of the document and survives browser saving and JSON export.

```json
{
  "schemaVersion": 1,
  "objectTypes": [
    {
      "id": "customer",
      "name": "Customer",
      "symbol": "♙",
      "description": "A person buying from our business.",
      "shape": "user"
    },
    {
      "id": "parcel-locker",
      "name": "Parcel locker",
      "symbol": "▥",
      "description": "An unattended pickup location.",
      "shape": "warehouse",
      "model": {
        "url": "models/parcel-locker.gltf",
        "rotation": [0, 0, 0]
      }
    }
  ],
  "groups": [{ "id": "pickup", "name": "Pickup experience" }],
  "objects": [
    { "id": "person", "name": "Customer", "group": "pickup", "type": "customer" },
    { "id": "locker", "name": "Pickup locker", "group": "pickup", "type": "parcel-locker" }
  ],
  "connections": [
    { "id": "collect", "from": "person", "to": "locker", "direction": "bidirectional" }
  ]
}
```

Import the ready-to-use [custom object example](../frontend/public/examples/custom-objects.json). The **Retail operations** preset also includes the bundled parcel locker. **Order approval workflow** demonstrates a custom Approval type using the built-in Processing shape.

| Custom type field | Contract |
| --- | --- |
| `id` | Required lowercase slug, unique within `objectTypes`; cannot replace a built-in ID |
| `name` | Required display name |
| `description` | Optional plain text |
| `symbol` | Optional text symbol, at most 8 Unicode characters; defaults to `◇` |
| `shape` | Any built-in type ID; defaults to `container`. Used alone or as a model fallback |
| `model.url` | Optional model definition; requires a relative asset path or HTTPS URL ending in `.glb` or `.gltf` |
| `model.rotation` | Optional `[X, Y, Z]` rotation in degrees, each from −360 to 360; defaults to `[0, 0, 0]` |

Up to 50 custom types are allowed. Shape aliases refer to built-ins, avoiding recursive custom-type chains. Symbols and names remain plain text, not HTML or executable code. Object decorators remain a separate future addition.

## Supply a model

The supported interchange format is **glTF 2.0**, including its `.glb` binary form. See the [Khronos format overview](https://www.khronos.org/gltf/) and [Three.js GLTFLoader documentation](https://threejs.org/docs/pages/GLTFLoader.html).

1. Export a **static, uncompressed mesh** as a self-contained GLB, or glTF with embedded buffers and images. Apply or remove rigs and morph targets before exporting.
2. Put the asset in `frontend/public/models/`, or host it at an HTTPS URL that permits browser CORS requests.
3. Reference it with `model.url`. Relative paths resolve under the deployed application's base path, including subdirectory hosting. Absolute paths, traversal, credentials in URLs, query strings, and temporary `blob:`/`file:` URLs are not supported.
4. Apply the configuration. While the model loads, the configured `shape` stays visible. A failed load retains that shape and displays an explanation in the directory.

The loader renders static mesh geometry using the selected [model theme](model-themes.md) and the group's color: luminous outlines and points in Wire, or solid grain-textured surfaces in Textured. Source materials, textures, lights, cameras, and animations do not determine the displayed appearance. Node transforms are baked into geometry; the configured rotation is applied, then the model is uniformly scaled to fit **4.6 × 2.5 × 2.5** scene units, centered on X/Z, and grounded at Y = 0. Labels, hit targets, connections, and elevation remain stable when the model replaces the fallback.

Limits per asset: 20 MB downloaded and decoded buffers, 100,000 mesh vertices after instancing, 256 mesh definitions, and 1,024 nodes. External buffer/image sidecars are rejected. Required extensions are limited to `KHR_materials_unlit`, `KHR_mesh_quantization`, and `KHR_texture_transform`; Draco, Meshopt, KTX2, rigged models, and morph targets are not supported in this version. Animated files are shown at their initial static transforms. The loader times out after 30 seconds, deduplicates loads within a scene, and discards results after the scene changes.

JSON export includes the model reference, not the model file. Keep referenced assets alongside the deployment when sharing it. Remote model hosts receive asset requests; the app sends no credentials with those requests. The bundled parcel-locker model is original project geometry and needs no external asset host.

## Add a built-in shape in code

1. Add metadata to `frontend/src/catalog/catalog.ts` with a stable ID, name, symbol, and description.
2. Add a geometry builder in `frontend/src/catalog/geometry.ts`, receiving a group color and returning a new `THREE.Group`.
3. Register it in `builders`. `Record<ObjectType, Builder>` checks completeness.
4. Add the new ID to the JSON Schema's custom `shape` enum, add an example, and run `npm test` and `npm run build`.

Everyday geometry lives in `catalog/everyday.ts`; shared `wire()`, `box()`, and `trace()` helpers live in `catalog/geometry-helpers.ts`.

Built-in geometry uses a base at Y = 0 and is centered at X/Z = 0. Keep it inside the common hit envelope (approximately 4.7 × 2.5 × 2.5 units), and return independently disposable geometry and materials. Reuse `wire()`, `box()`, and `trace()` for the visual style. Leave camera movement, labels, selection, connections, and persistence to their existing modules.
