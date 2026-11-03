# 3D model themes

Choose **Model theme** in the bottom view controls:

| Theme | Appearance |
| --- | --- |
| **Wire** (`wire`) | The original luminous outlines and point samples. This remains the default for existing documents and presets. |
| **Textured** (`textured`) | Solid surfaces with a subtle woven grain, soft directional lighting, matte shading, and restrained edge outlines. Group colors remain visible. Hover and selection add a gentle glow. |

The theme applies to every object in the document, including built-in shapes, custom types using built-in shapes, imported glTF/GLB geometry, and loading/error fallback shapes. It changes model appearance only. Plane and group decorations, frame switches, visibility, connectors, layout, elevations, and the page colors retain their existing controls.

Switching themes keeps the current camera position, filters, space focus, and inspector. Pending custom-model loads are cancelled when the scene is rebuilt; late results cannot replace the new theme. Linked outer spaces remain dimmed, including solid surfaces.

The choice is saved locally and included in configuration export:

```json
"view": {
  "modelTheme": "textured"
}
```

Omitting `modelTheme` selects `wire`. Unsupported IDs are rejected before applying a configuration. The choice is a document-wide view setting; importing a preset as a new space retains the destination document's theme. Applying an entire preset uses that preset's view settings.

## Texture and model behavior

The textured finish is generated locally as a small deterministic texture. No texture files, image services, or additional downloads are required. Each object owns its texture and materials, which are disposed when its scene is replaced.

Imported models use the same group-colored finish rather than their authored materials or image textures. Existing UV coordinates are retained; meshes without UVs receive projected coordinates, and missing normals are calculated. Model proportions, fit, rotation, hit targets, and connection anchors remain unchanged. Decorative line-only parts remain line geometry in both themes.

## Extending themes

`frontend/src/catalog/themes.ts` contains the theme catalog, stable IDs, surface finishing, procedural texture, and highlighting. The selector and validator use that catalog. Geometry builders preserve triangle surfaces until the selected appearance is applied; Wire discards those surfaces and Textured uses them. Built-in and imported models share this finishing step.

For another theme, add its catalog entry and rendering behavior, update the JSON Schema enum, and check built-in/custom geometry, selection, dimming, and resource ownership. Theme data is declarative; configuration cannot inject shader code or executable renderers.
