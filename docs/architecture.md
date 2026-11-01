# Architecture and scope

## Data flow

`architecture.json / imported JSON / localStorage → validation → normalized ArchitectureConfig → UI + scene`

The document is the source of truth. The renderer does not infer service meaning, invent connections, or read storage. UI actions coordinate the scene and document persistence. Configuration changes rebuild disposable scene resources; camera and directory actions do not mutate the architecture.

## Module boundaries

- **config**: plain TypeScript data contracts, defaults, validation, legacy migration, and browser storage. Tests run without a browser.
- **catalog**: metadata registry plus geometry builders. Semantic type lookup does not import Three.js; geometry is separate.
- **scene/layout**: pure deterministic placement. Group platforms have predictable bounds and cannot overlap.
- **scene/viewer**: Three.js renderer, controls, raycasting, labels, directed connection paths, animation, and resource disposal. Receives a config and emits object selection callbacks.
- **ui**: application shell, directory, search/filter state, inspector, catalog, and JSON editor. Dynamic user data is inserted as text.

## Version 1 choices

TypeScript + Vite + Three.js keep local development familiar without a backend or a large UI framework. Dependencies are installed through a committed npm lockfile. The app is a static client and can be hosted independently of ChatGPT Sites.

The original explorer's grouped platforms, luminous objects, camera navigation, and inspector concept are retained. Its monolithic script has been replaced with readable modules; its vendor-specific content and branding have been replaced with configurable presentation and a generic example. Explicit object relationships replace decorative inter-group links.

The initial catalog has Container plus the seven requested specialized types. No attempt is made to guess technology or architecture from object names. Stable IDs permit duplicate names and renaming without breaking links.

## Deliberately deferred

- Decorators and technology badges, including SQLite and file-system attributes.
- Graphical drag-and-drop authoring, nested groups, manual horizontal node positions, and custom edge routing. Signed vertical elevation is supported for groups and objects.
- Multi-user editing, backend persistence, authentication, and Git synchronization from the browser.
- Telemetry ingestion and automatic architecture discovery.
- A plugin loader or remotely loaded executable geometry.

Future decorators should be a versioned data-model addition with explicit preservation, validation, and rendering rules. The current validator normalizes supported fields and drops unknown ones; v1 must not be used to store extension attributes that need to survive export.
