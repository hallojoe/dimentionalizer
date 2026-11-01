# Adding an object type

Object types describe recognizable base shapes. Technology-specific decorators are deliberately separate future work.

1. Add an entry to `frontend/src/catalog/catalog.ts` with a stable lowercase `id`, display `name`, directory `symbol`, and short `description`.
2. Add a geometry builder in `frontend/src/catalog/geometry.ts`. It receives the group color and returns a new `THREE.Group`.
3. Register that builder in the `builders` map. Its `Record<ObjectType, Builder>` type makes missing entries a compile error.
4. Add an example object using the new type, and run `npm test` and `npm run build` from `frontend/`.

The UI catalog, type filter, inspector, and validator consume the registry; they do not need switch statements for every type. Unknown types always resolve through `resolveType()` to Container while retaining the original identifier in the document.

## Geometry contract

- Center the object around X/Z = 0, with its base at Y = 0.
- Keep it within approximately 4.7 × 2.5 × 2.5 world units. The current common hit target and layout use this envelope.
- Return new geometry/material instances for each object. The scene owns their lifecycle and disposes them on rebuild and teardown.
- Use the supplied color; it identifies the object's group. Type is communicated by shape.
- Use `wire()`, `box()`, and `trace()` helpers for the shared visual style. If a new primitive needs textures, add explicit texture disposal to the scene lifecycle.
- Leave labels, hit-testing, camera movement, and persistence to their existing modules.

The scene wraps the geometry with a consistent hit target and highlights its point samples when selected or hovered. Connection endpoints currently attach to the center at Y = 1.5.

For substantially larger or nested objects, extend the layout/geometry contract deliberately rather than slipping oversized geometry into this envelope.
