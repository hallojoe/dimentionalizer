# Visibility and frames

Use **Plane frames** and **Group frames** in the bottom view controls to remove their surfaces, outlines, grids, and headings while keeping objects and connections visible. The existing **Grid** control separately toggles the world reference grid. **Names** controls object labels. Space outlines remain available as context in combined views.

Every plane, group, and object has a **Show plane/group/object** switch in its inspector. Planes and groups also have **Show frame** for individual control. Select a plane in the directory and click **Inspect plane & connections**; select a group and click **Inspect group & connections**; click an object to inspect it.

| Setting | Effect |
| --- | --- |
| `view.showPlaneFrames` | Global gate for all plane surfaces, borders, finite grids, and headings |
| `view.showGroupFrames` | Global gate for all group surfaces, borders, and headings |
| Plane or group `showFrame` | Individual frame preference, combined with the corresponding global gate |
| Plane `visible` | Show/hide the plane, all its groups and objects, and connectors attached to those entities |
| Group `visible` | Show/hide the group, its objects, and their connectors |
| Object `visible` | Show/hide its geometry, label, hit target, and connectors |

All fields are optional booleans and default to `true`. Existing documents retain their appearance. A hidden frame does not hide its contents or connectors. A hidden entity gates descendants, even when their own `visible` switch is on. Restoring a parent preserves children that were individually hidden.

Hidden entities remain in the directory, marked **Hidden**, so their inspector switches are always reachable within the selected space and filters. The inspector explains when a visible child is hidden by its parent. Hidden portal objects can be inspected from the directory without automatically entering their linked space. Hiding a portal does not hide the separate space it points to.

Visibility does not repack the layout: positions, spacing, elevations, and camera bounds remain stable. Connectors and animated dots require both endpoints to be visible and included by the current filters. Showing a frame does not override a hidden parent or hidden space. A visible parent retains its own frame and connectors when its children are individually hidden.

Individual frame settings survive global frame toggles. Plane decoration preferences also survive: turning a plane frame back on restores its configured fill opacity, border, grid, and label settings.

```json
{
  "schemaVersion": 1,
  "view": {
    "showPlaneFrames": false,
    "showGroupFrames": false,
    "showGrid": false
  },
  "planes": [{ "id": "main", "name": "Main", "visible": true }],
  "groups": [{ "id": "work", "name": "Work", "plane": "main", "showFrame": false }],
  "objects": [
    { "id": "current", "name": "Current step", "group": "work", "visible": true },
    { "id": "later", "name": "Later step", "group": "work", "visible": false }
  ]
}
```

Settings persist in browser storage and JSON import/export. Space duplication and template import preserve the per-entity settings; the destination document keeps its global view settings. **Reset view** resets navigation and filters, not visibility preferences.
