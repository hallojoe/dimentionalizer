# Dimentionalizer

A configurable 3D structure explorer for systems, people, products, places, and workflows. Describe your model in JSON, then explore its spaces, planes, groups, objects, and connections. Every object is a container by default; choose a specialized type when its shape communicates more.

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
| `frontend/public/presets/` | Twenty-one categorized structure presets and their metadata index |
| `frontend/public/architecture.schema.json` | JSON Schema for editor assistance |
| `frontend/src/config/` | Document types, defaults, runtime validation, migration, and browser persistence |
| `frontend/src/catalog/` | Built-in and custom type resolution, geometry builders, and glTF/GLB loading |
| `frontend/public/models/` | Self-contained model assets, including an original custom example |
| `frontend/src/presets/` | Preset catalog contract and validated, cancellable document loading |
| `frontend/src/scene/` | Deterministic plane/group layout, camera, selection, connections, and GPU lifecycle |
| `frontend/src/ui/` | Directory, inspector, configuration editor, and app coordination |
| `frontend/src/style.css` | Responsive application styling |
| `frontend/tests/` | Behavior-focused automated tests |
| `docs/` | Configuration contract and extension guide |

The frontend uses **TypeScript, Vite, and Three.js**, with native DOM components. There is no backend or framework-specific server dependency.

## Version 1

- **40 built-in types** covering infrastructure, people, business entities, and workflows. New business shapes: **User, User group, Event, Product, Shop, Warehouse**.
- Everyday shapes include Human, Family, Adult, Child, Food, Bed, Shower, Toilet, Sofa, Chair, Desk, Wall, Window wall, Bus, Train, Airplane, Office, and Home.
- Workflow, Request, Response, Processing, Webhook, API call, Dataflow, and Message types; use E-mail for send-mail steps and Message for Slack notifications. These describe a process; they do not execute it.
- Custom `objectTypes` with names, symbols, and reusable built-in shapes or self-contained **glTF 2.0 / GLB** models. Imported geometry fits the existing wire style and layout; loading failures retain a fallback shape.
- Omitted types default to Container; unknown types retain their identifier but render as Container with a warning.
- Configurable brand text, browser title, eyebrow, headline, description, accent, background, group names and colors.
- Grouped 3D platforms, orbit/pan/zoom, group and object focus, labels, automatic orbit, and animated directional connection packets.
- Multiple spaces: create blank, start from a preset template, or duplicate an existing space; show one, several, or all together. Object portals pan into a linked space, dim the surrounding context, and retain the inspector. Back restores the previous view.
- Connector styles **Normal, Lightning, Wobbly**, with optional independent in/out capacities expressed as lane thickness.
- Spacing on spaces, planes, groups, and objects: margin or padding, applied to self or direct children with explicit child overrides.
- Saved object checklists for planning and learning, displayed in the existing inspector.
- Global and individual plane/group frame controls, plus visibility switches for planes, groups, and objects. Hidden entities remain reachable in the directory; layout and child preferences are preserved.
- Configurable planes with auto-fit or locked dimensions, color, opacity, border, grid, and labels. Groups reference their parent plane; existing documents receive a default auto-fit plane.
- Signed plane, group, and item elevation controls (`0` baseline, positive above, negative below), plus independently toggleable ground-grid visibility. Settings persist and export with the configuration.
- Search and type filtering; keyboard-accessible directory and inspector. Left/right arrows browse objects while inspecting; Escape closes the inspector.
- Connections between planes, groups, and items, with one-way or bidirectional animated dots and inspector controls. Explicit labels and incoming/outgoing inspection. Only configured connections are displayed; no dependencies are inferred from proximity.
- JSON editing, import, validated export, default restoration, and browser-local persistence.
- Preset picker with seven common system setups, a source-grounded Umbraco Cluster snapshot, three business/workflow examples, five human-situation examples, four detailed planning/workflow walkthroughs, and a fictional 16-year CV; open any preset as an editable draft before applying it.
- Migration of the original `{ name, group, text }[]` format into a version 1 document.
- Responsive layout, reduced-motion support, and a usable WebGL fallback.

Try **Presets → Work & study → A CV in layers · 16 years** for six chronological employment planes and three parallel private side businesses. See the [CV walkthrough](docs/career-cv.md).

Try **Presets → Planning & learning → A whole day, outside and inside** for an elevated workflow with a workday portal and saved checklists.

Try **Presets → Home & family → Home and neighborhood**. Click the Home object to move from outside to inside, then use **Back to outer view**. **Spaces** manages creation and visible spaces; the directory’s **Space** selector changes focus.

Elevation composes as **world → plane → group → item**: plane `10` + group `-3` + item `-2` = world `5`. Choose a plane in the directory to inspect its properties; inspect a group to change its parent plane. Try the [three-plane example](frontend/public/examples/planes.json) through **Configure → Import JSON**.

Open **Configure** to edit the active document. Imported files and **Load default** update the editor draft; only **Apply configuration** changes the explorer. **Export draft** validates and downloads the document currently in the editor.

Open **Presets** to choose a three-tier web application, multi-tenant SaaS, e-commerce platform, background job system, headless publishing platform, real-time collaboration system, analytics pipeline, the linked Umbraco local Cluster, **Retail operations**, **Event launch**, or **Order approval workflow**. The current architecture remains active until you apply the selected draft. See [preset details and Umbraco source mapping](docs/presets.md).

Changes are stored locally under `dimentionalizer.config.v1` for the browser's origin. They are **not** committed to GitHub or saved on a server. To share a configuration, export it and replace `frontend/public/architecture.json` in your checkout. If an old local override hides changes to that file, choose **Configure → Load default → Apply configuration**.

## Customize and extend

- [Visibility switches and frame controls](docs/visibility.md)
- [Spacing, overrides, and planning checklists](docs/spacing.md)
- [Spaces, portals, and connector capacity](docs/spaces.md)
- [Configuration reference](docs/configuration.md)
- [Presets and source mapping](docs/presets.md)
- [Built-in types, custom vocabulary, and glTF/GLB models](docs/object-types.md)
- [Design and scope](docs/architecture.md)

Decorators (such as `sqlite` or `file-system`) are intentionally deferred. They are future attributes of an object, not new base object types. Version 1 does not implement decorator storage or rendering.

## Hosting

`npm run build` emits a static site in `frontend/dist/`. Serve the complete directory on any static host. For a subdirectory deployment, use `npm run build -- --base=/your-path/` so assets and the configuration load under that path. Vite's development server is for local development, not production.

## Verification limits

Automated checks cover configuration validation/migration, presets, catalog geometry, space duplication, portal references, connector styles/capacities, plane layout, glTF/GLB parsing, model fit, loading failures, cancellation, disposal, and JSON/browser-storage round trips. The production build includes TypeScript validation. Interactive browser and visual QA could not be completed in the creation environment because its managed preview service was unavailable. The GPU rendering path still needs a smoke test in a WebGL-capable browser.

## Third-party software

Three.js and other dependencies are installed from npm; their licenses remain with their respective authors. See [third-party notes](docs/third-party.md).
