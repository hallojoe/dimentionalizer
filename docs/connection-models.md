# Moving connection models

Connection effects use miniature catalog models instead of dots. Select an object, group, or plane and find its connections in the inspector. Under **Moving connection models**, choose the **From → To model** and, for a bidirectional connection, the **To → From model**. Direction always refers to the connection's configured endpoints, regardless of which endpoint you are inspecting.

Choose **Key / Login** for authentication, **E-mail** for email delivery, **Response** for acknowledgements, or any other built-in or custom object type. Choices are explicit: naming an endpoint "Email" does not change its connection models automatically. Existing connections without a model setting use **Message** in both directions.

## Try the email example

Open **Presets → Infrastructure → Email login and delivery**, then apply it. The preset starts with Textured models and Effects enabled:

- Mail client → E-mail service: **Key**, with **Response** returning.
- E-mail service → Outgoing mail queue: **E-mail** envelope.
- Outgoing mail queue → Recipient mailbox: **E-mail**, with **Response** returning.

It illustrates login and delivery concepts; it does not authenticate or send mail.

## Lifecycle and controls

Each model starts at zero scale and opacity, grows and fades in near its source, eases along the connector, then shrinks and fades to zero at the destination. It remains invisible for the configured pause before another traversal. Resetting its position happens while it is invisible. Both directions have independent visual models and staggered starting times. Models face the camera to keep their symbols readable.

| Field | Inspector control | Default and range |
| --- | --- | --- |
| `flow.out` | From → To model | `message`; a built-in or custom type ID |
| `flow.in` | To → From model | Omit to follow `out`; used only for bidirectional connections |
| `flow.size` | Model size | `1.4`; longest dimension at full scale, from `0.2` to `6` scene units |
| `flow.duration` | Travel time | `5` seconds; from `0.5` to `60` |
| `flow.gap` | Pause after arrival | `0.7` seconds; from `0` to `30` |

```json
{
  "id": "login",
  "from": "client",
  "to": "mail-service",
  "direction": "bidirectional",
  "style": "normal",
  "flow": {
    "out": "key",
    "in": "response",
    "size": 1.8,
    "duration": 4,
    "gap": 0.8
  }
}
```

For a separate connection leaving the mail service, set `flow.out` to `email`. The return model setting is preserved when switching a connection temporarily to one-way. Unknown model IDs are preserved with a validation warning and a Container fallback, matching ordinary objects.

## Integration

- **Wire / Textured:** models follow the document's model theme, including imported glTF/GLB appearances and fallbacks.
- **Effects:** hides or shows moving models independently of the connector lines.
- **Reduced motion:** shows stationary, full-size models at separate points along forward and return lanes, with no travel or pulsing.
- **Visibility:** both endpoints must be visible and pass the active filters. Hidden parents hide their descendant connections. Outer-space dimming multiplies lifecycle opacity without accumulating.
- **Capacity:** remains a decoration of the connection's line width. A zero-capacity lane has no moving model; model size is controlled separately.
- **Persistence:** model choices and animation settings survive JSON export, browser saving, space duplication, and template import. Custom types used only by connections are retained and remapped when IDs conflict.

Geometry is created once per lane and reused for each traversal; the animation changes only its position, orientation, scale, and opacity. Custom models share the scene's asset loader, replace a built-in fallback after loading, and respect scene cancellation and disposal. Line styles and connection endpoints are unchanged. These animations describe the document; they are not live traffic or evidence that an operation occurred.
