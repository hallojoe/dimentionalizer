# Dimentionalizer

A configurable 3D architecture explorer. Describe a system in JSON, then explore its groups, objects, and connections. Every object is a container by default; choose a specialized type when its shape communicates more.

Version 1 builds on the original container explorer's grouped platforms, luminous wire geometry, orbit navigation, and object inspection. It is product-neutral: branding, page title, headline, description, colors, and architecture all come from configuration.

## Run locally

Prerequisite: **Node.js 22.12 or newer** (Node 24 LTS also works), with npm.

```bash
git clone https://github.com/hallojoe/dimentionalizer.git
cd dimentionalizer/frontend
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). No backend, account, API keys, or environment variables are needed. Use a browser with WebGL 2 and hardware acceleration for the 3D view. When WebGL is unavailable, the object directory, inspector, connections, and configuration editor remain usable.

```bash
npm test          # Configuration, layout, and geometry tests
npm run typecheck # TypeScript validation
npm run build     # Typecheck and production build → frontend/dist/
npm run preview   # Serve the production build locally
```

## Solution structure

| Path | Responsibility |
| --- | --- |
| `frontend/public/architecture.json` | Default architecture and presentation settings; edit this to customize a deployment |
| `frontend/public/examples/` | Small importable starting documents |
| `frontend/public/presets/` | Eight selectable architecture presets and their metadata index |
| `frontend/public/architecture.schema.json` | JSON Schema for editor assistance |
| `frontend/src/config/` | Document types, defaults, runtime validation, migration, and browser persistence |
| `frontend/src/catalog/` | Predefined object metadata and independent 3D geometry builders |
| `frontend/src/presets/` | Preset catalog contract and validated, cancellable document loading |
| `frontend/src/scene/` | Deterministic group layout, camera, selection, connections, and GPU lifecycle |
| `frontend/src/ui/` | Directory, inspector, configuration editor, and app coordination |
| `frontend/src/style.css` | Responsive application styling |
| `frontend/tests/` | Behavior-focused automated tests |
| `docs/` | Configuration contract and extension guide |

The frontend uses **TypeScript, Vite, and Three.js**, with native DOM components. There is no backend or framework-specific server dependency.

## Version 1

- Eight predefined shapes: **Container, Database, E-mail, Cache, Reverse proxy, Queue, Storage, CDN**.
- Omitted types default to Container; unknown types retain their identifier but render as Container with a warning.
- Configurable brand text, browser title, eyebrow, headline, description, accent, background, group names and colors.
- Grouped 3D platforms, orbit/pan/zoom, group and object focus, labels, automatic orbit, and animated directional connection packets.
- Search and type filtering; keyboard-accessible directory and inspector. Left/right arrows browse objects while inspecting; Escape closes the inspector.
- Explicit connections with labels and incoming/outgoing inspection. Only configured connections are displayed; no dependencies are inferred from proximity.
- JSON editing, import, validated export, default restoration, and browser-local persistence.
- Preset picker with seven common system setups plus a source-grounded Umbraco Cluster snapshot; open any preset as an editable draft before applying it.
- Migration of the original `{ name, group, text }[]` format into a version 1 document.
- Responsive layout, reduced-motion support, and a usable WebGL fallback.

Open **Configure** to edit the active document. Imported files and **Load default** update the editor draft; only **Apply configuration** changes the explorer. **Export draft** validates and downloads the document currently in the editor.

Open **Presets** to choose a three-tier web application, multi-tenant SaaS, e-commerce platform, background job system, headless publishing platform, real-time collaboration system, analytics pipeline, or the linked Umbraco local Cluster. The current architecture remains active until you apply the selected draft. See [preset details and Umbraco source mapping](docs/presets.md).

Changes are stored locally under `dimentionalizer.config.v1` for the browser's origin. They are **not** committed to GitHub or saved on a server. To share a configuration, export it and replace `frontend/public/architecture.json` in your checkout. If an old local override hides changes to that file, choose **Configure → Load default → Apply configuration**.

## Customize and extend

- [Configuration reference](docs/configuration.md)
- [Presets and source mapping](docs/presets.md)
- [Adding an object type](docs/object-types.md)
- [Design and scope](docs/architecture.md)

Decorators (such as `sqlite` or `file-system`) are intentionally deferred. They are future attributes of an object, not new base object types. Version 1 does not implement decorator storage or rendering.

## Hosting

`npm run build` emits a static site in `frontend/dist/`. Serve the complete directory on any static host. For a subdirectory deployment, use `npm run build -- --base=/your-path/` so assets and the configuration load under that path. Vite's development server is for local development, not production.

## Verification limits

The initial release was typechecked, production-built, and tested for configuration validation/migration, catalog coverage, geometry construction, and group layout. Interactive browser and visual QA could not be completed in the creation environment because its managed preview service was unavailable. The GPU rendering path still needs a smoke test in a WebGL-capable browser.

## Third-party software

Three.js and other dependencies are installed from npm; their licenses remain with their respective authors. See [third-party notes](docs/third-party.md).
