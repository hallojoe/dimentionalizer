# Spaces, portals, and connectors

Spaces let one document describe both an outside view and what is inside an object. A space owns planes; planes own groups; groups own objects. The existing elevation calculation remains plane + group + item relative to world zero.

## Create and choose views

Open **Spaces** in the header. Enter a name and choose:

- **Blank space**: creates an empty space with a default plane and Contents group, ready for objects in Configure.
- **A preset template**: adds the preset's spaces and content to the current document. A multi-space template retains its interior links. The first imported space uses your chosen name; additional spaces use that name as a prefix.
- **Duplicate an existing space**: copies that space's planes, groups, objects, and internal connectors with new IDs. Object links to other existing spaces remain valid. Connectors crossing the copied space boundary are not duplicated.

Creation preserves existing spaces and custom types. Conflicting custom type definitions receive distinct IDs. Invalid or oversized results leave the current document unchanged. The document-wide limits remain 50 planes, 50 groups, 500 objects, and 2,000 connectors, plus at most 50 spaces and 50 custom types.

Use space checkboxes to choose the visible set, **View alone** for a single space, or **Show all spaces together** for an overview. At least one space stays visible. The directory's **Space** selector focuses a space while dimming other visible spaces; **Combined view** restores full brightness to the chosen set. Visibility and active focus are saved and exported.

## Connect an object to an interior

Select an object and set **Open space when clicked** in its existing inspector. Choose any other space. The object's directory row names its destination and its scene label gains a `↳` marker.

Clicking that object then:

1. Keeps the current visible spaces and adds the destination if it was hidden.
2. Pans the camera to the destination space.
3. Dims the other visible spaces and their labels/connectors to provide context.
4. Keeps the clicked object's details in the existing inspector.

Use **Back to outer view** to restore the previous visible set and focus. Navigation history lasts for the current session; the current view itself survives reload. Selecting **No linked space** removes the portal. The inspector's **Enter …** button can reopen the destination without changing selection. Navigation works in the WebGL fallback directory too, without camera animation.

Spaces are arranged beside one another with non-overlapping footprints. A portal is a navigation relationship, not geometric containment inside a scaled object. Multiple objects may open the same space, and spaces may link back to one another. A portal cannot point to its own containing space. Ordinary typed space endpoints on a connector describe relationships; `linkedSpace` is the explicit click-navigation target.

```json
{
  "schemaVersion": 1,
  "spaces": [
    { "id": "outside", "name": "Neighborhood" },
    { "id": "inside", "name": "Inside home" }
  ],
  "spaceView": { "visible": ["outside", "inside"], "active": "outside" },
  "planes": [
    { "id": "street", "name": "Street", "space": "outside" },
    { "id": "rooms", "name": "Rooms", "space": "inside" }
  ],
  "groups": [
    { "id": "buildings", "name": "Buildings", "plane": "street" },
    { "id": "living", "name": "Living room", "plane": "rooms" }
  ],
  "objects": [
    { "id": "home", "name": "Home", "type": "home", "group": "buildings", "linkedSpace": "inside" },
    { "id": "sofa", "name": "Sofa", "type": "sofa", "group": "living" }
  ],
  "connections": [
    { "id": "inside-link", "from": "home", "to": { "kind": "space", "id": "inside" }, "label": "Interior" }
  ]
}
```

Older documents receive one `main` space named Main space. Planes without `space` use the first space. An omitted `spaceView` shows every space at full brightness. Entity IDs remain globally unique within each kind so cross-space relationships stay unambiguous.

## Connector appearance and capacity

Every connection can use `style: "normal"`, `"lightning"`, or `"wobbly"`. Normal is a smooth arc; Lightning uses angular segments; Wobbly uses a repeating wave. Moving models follow the same styled path. Direction remains `forward` or `bidirectional`.

Enable **Show capacity** under a connection in an object, group, or plane inspector, or configure it in JSON:

```json
{
  "id": "bus-train",
  "from": "bus",
  "to": "train",
  "direction": "bidirectional",
  "style": "lightning",
  "capacity": { "out": 300, "in": 150, "unit": "people/hour" }
}
```

| Field | Meaning |
| --- | --- |
| `out` | Capacity from `from` to `to` |
| `in` | Capacity from `to` back to `from`; rendered as a return lane for bidirectional connectors |
| `unit` | Optional shared unit, such as `people/hour` or `Mbps`, up to 40 characters |

At least one capacity value is required when the decoration is present. Each value is finite, from 0 to 1,000,000,000; fractions are allowed. Blank fields are unspecified, not zero. A zero value draws a very thin lane and pauses that lane's model. Omitted capacity keeps the thin default connector.

Two-way decorated connectors have independent outbound and return lanes. Widths use a bounded square-root scale relative to the largest configured capacity with exactly the same unit string. Different units are not compared; unitless capacities form their own set. This expresses relative capacity rather than measured throughput. Bigger configured capacities make thicker lanes, with the largest capped to keep the scene readable. Exact values remain in the inspector and exported JSON.

The Effects toggle still hides moving models independently of the connectors. Reduced-motion preference shows stationary models and makes camera transitions immediate. Style, direction, and capacity controls retain the existing inspector layout.
