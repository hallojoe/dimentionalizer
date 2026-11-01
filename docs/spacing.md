# Spacing and planning checklists

## Spacing controls

Objects, groups, planes, and spaces can have an optional spacing rule:

```json
"spacing": { "mode": "margin", "target": "children", "value": 2 }
```

| Field | Meaning |
| --- | --- |
| `mode` | `margin` (default) reserves room outside the target's footprint; `padding` adds room inside it |
| `target` | `self` (default) or `children` |
| `value` | Required extra scene units on each horizontal side, from `0` to `1000`; fractions are allowed |

Use **Spacing → Own spacing setting** in an object, group, or plane inspector. Space settings are under **Spaces → Spacing · [name]**. Clear the own-setting checkbox to return to inheritance or the baseline layout. An explicit `0` overrides inherited spacing without adding extra room.

Spacing adds to the existing layout clearances; it does not replace them. It affects X/Z placement and footprints, never elevation or the visual scale of an object. All built-in types and custom model types use the same spacing contract.

## Targets and overrides

**Self** applies to the selected entity. **Children** sets a default on every immediate layout child:

| Parent | Direct children |
| --- | --- |
| Space | Planes in that space |
| Plane | Groups on that plane |
| Group | Objects in that group |
| Object | None; objects support `self` only |

A child with **any own spacing setting** takes precedence. This includes zero and a child rule that targets its own children. In that last case, the child keeps its baseline self spacing and supplies a new default to the next level. Defaults do not skip levels, cascade through every descendant, or follow `linkedSpace` portals. Imported model meshes are visual parts, not layout children.

For example, this group gives every object an extra margin of three units per side. The specific item opts out with zero:

```json
{
  "schemaVersion": 1,
  "groups": [
    { "id": "steps", "name": "Workflow steps",
      "spacing": { "mode": "margin", "target": "children", "value": 3 } }
  ],
  "objects": [
    { "id": "one", "name": "First step", "type": "processing", "group": "steps" },
    { "id": "two", "name": "Compact step", "type": "processing", "group": "steps",
      "spacing": { "mode": "margin", "target": "self", "value": 0 } }
  ]
}
```

## Layout behavior

- **Object margin** reserves space outside its cell. **Object padding** reserves space inside the cell around its model. Both can spread neighboring items without stretching the model. Because leaf objects have no visible container surface or layout children, these two modes can produce the same placement.
- **Group margin** separates groups while keeping the visible group platform unchanged. **Group padding** expands that platform around its objects.
- **Plane margin** reserves room between planes. **Plane padding** adds interior room around group footprints, including their margins. Auto-fit planes grow accordingly.
- **Locked planes** keep their exact dimensions. Added padding reduces the room available to contents; if contents plus spacing cannot fit, an overflow notice appears. Overflow and spacing still reserve room in the parent's layout, so neighboring planes remain separated.
- **Space margin** separates spaces; **space padding** expands the space footprint around its planes.

Variable object cells use the widest item in each column and the deepest item in each row. This preserves a readable grid and avoids overlaps when individual values differ. Extra space on one item can therefore widen a shared column or row. Spacing is not a manual X/Z position control. Omitted spacing preserves the previous baseline behavior, including existing locked-plane dimensions and overflow rules.

## Checklists for planning and learning

An object can contain up to 20 checklist items. Define them in Configure; check them in the existing inspector:

```json
"checklist": [
  { "id": "purpose", "text": "State the intended outcome.", "done": false },
  { "id": "handoff", "text": "Name the next owner and action.", "done": false }
]
```

Each item requires an ID unique within that object's checklist and non-empty text. `done` defaults to `false`. The inspector shows a completion count. Checking a box saves the document locally and appears in JSON export without rebuilding the scene or changing camera focus. It does not execute the workflow, block a connector, or notify another person.

Duplicating a space copies checklist state and spacing independently. Starting from a preset creates the preset's unchecked checklist state. The current view, spacing, and checks remain part of the same portable document; there is no separate task server or shared completion state.

## Richer examples

| Preset | Planning or learning focus |
| --- | --- |
| A whole day, outside and inside | Morning handoffs, commute, a workday portal, focused work, interruptions, recovery, and next-day preparation |
| An application through many reviewers | Six intake/review/decision instances, clarification loops, approval or decline, fulfillment, and reflection |
| One request across service instances | Alternative application and worker instances, shared data, response, retry, exhausted work, and tracing |
| Plan a household week | Shared commitments, owners, meals, errands, work, study, downtime, changes, and review |

The first, second, and fourth are in **Planning & learning**; the service walkthrough is in **Infrastructure**. Each uses named planes above and below world zero plus group/item offsets. Heights distinguish conceptual stages and exception paths, not physical floors, elapsed time, or measured importance. Times, policies, and responsibilities are illustrative and editable.
