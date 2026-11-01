# Architecture and scope

## Data flow

`architecture.json / imported JSON / localStorage → validation → normalized ArchitectureConfig → UI + scene`

The document is the source of truth. The renderer does not infer service meaning, invent connections, or read storage. UI actions coordinate the scene and document persistence. Configuration changes rebuild disposable scene resources; camera and directory actions do not mutate the architecture.

## Module boundaries

- **config**: plain TypeScript data contracts, defaults, validation, legacy migration, and browser storage. Tests run without a browser.
- **catalog**: built-in metadata, custom type resolution, geometry builders, and glTF/GLB model loading. Semantic type lookup does not import Three.js; geometry is separate.
- **scene/layout**: pure deterministic placement. Spaces pack planes; planes pack group footprints, with auto-fit or locked surfaces. Overflow remains visible and contributes to spacing between planes. World positions compose plane, group, and item elevations.
- **scene/viewer**: Three.js renderer, controls, raycasting, labels, typed plane/group/object connection paths and directional packets, animation, and resource disposal. Receives a config and emits object, group, and plane selection callbacks.
- **ui**: application shell, directory, search/filter state, inspector, catalog, and JSON editor. Dynamic user data is inserted as text.

## Version 1 choices

TypeScript + Vite + Three.js keep local development familiar without a backend or a large UI framework. Dependencies are installed through a committed npm lockfile. The app is a static client and can be hosted independently of ChatGPT Sites.

The original explorer's grouped platforms, luminous objects, camera navigation, and inspector concept are retained. Its monolithic script has been replaced with readable modules; its vendor-specific content and branding have been replaced with configurable presentation and a generic example. Explicit relationships between planes, groups, and objects replace decorative links.

The catalog has 40 built-in types spanning infrastructure, business entities, people, and workflows. Custom types separate domain meaning from built-in or imported appearance. No attempt is made to guess technology or architecture from object names. Stable IDs permit duplicate names and renaming without breaking links.

## Deliberately deferred

- Decorators and technology badges, including SQLite and file-system attributes.
- Graphical drag-and-drop authoring, nested groups, manual horizontal node positions, and custom edge routing. Signed vertical elevation is supported for planes, groups, and objects.
- Multi-user editing, backend persistence, authentication, and Git synchronization from the browser.
- Telemetry ingestion and automatic architecture discovery.
- Executable renderer plugins and workflow execution. Custom declarative types and static glTF/GLB mesh assets are supported.

Future decorators should be a versioned data-model addition with explicit preservation, validation, and rendering rules. The current validator normalizes supported fields and drops unknown ones; v1 must not be used to store extension attributes that need to survive export.

## Plane compatibility

Planes extend the version 1 document additively. Validation supplies an implicit auto-fit plane at zero for older documents, assigns groups without a parent to the first plane, and defaults connection direction to forward. String connection endpoints remain object IDs; typed endpoints distinguish plane, group, and object namespaces. Plane decoration controls the surface appearance and is separate from deferred object decorators. Layout and connection anchors are pure functions tested independently of WebGL.

## Model loading lifecycle

`objectTypes` is normalized and validated with the document. The resolved catalog drives geometry, names, symbols, filters, and inspector choices. A model type starts with its built-in fallback shape. Each scene owns a `ModelLibrary`, which loads and parses each asset URL once, normalizes independent wire visuals, and replaces only the object's appearance. Stable hit targets, positions, and callbacks remain owned by the viewer.

Scene replacement cancels pending model requests and disposes cached geometry. A generation check prevents late completions from attaching to a newer scene. Source GPU resources, textures, and image bitmaps are disposed after mesh extraction; generated resources are disposed on replacement/teardown. Loader errors are displayed without discarding the object or document. The Three.js GLTFLoader addon is dynamically imported only for model-backed objects.

## Spaces and context

Spaces sit above planes in the document. Their IDs, plane memberships, object portal targets, visible-space set, and active focus are validated together. Older documents receive a single Main space. Space identity adds no elevation offset: world → plane → group → item remains the vertical coordinate contract.

`config/spaces.ts` owns immutable creation/import/duplication and view transitions. Imports remap all entity IDs, typed endpoints, portal targets, and conflicting custom-type definitions. Duplication preserves links to external portal targets while omitting connectors crossing the copied space boundary. Limits are validated on the completed candidate before the UI replaces the active document.

The viewer retains all space geometry, separates space footprints horizontally, and applies visibility and opacity independently of object filtering. Entering a portal updates the visible-space set and active focus, flies the camera to the destination, and leaves the selected object's inspector intact. Back restores a prior view state. This is linked-space navigation, not recursive geometry embedded inside an object's mesh.

Connector styles produce shared curves for both tube geometry and moving dots. Capacity widths use a bounded square-root scale normalized against other capacities with the same unit; two-way capacity decoration creates separate outbound and inbound lanes. A zero-capacity lane remains visible with no animated dot.
