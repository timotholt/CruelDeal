# UI Template And CMS Content Contract

Status: draft
Date: 2026-06-04

## Goal

Separate app-owned UI structure from CMS-authored mission/content data.

The UI template describes trusted interface shape: nodes, skins, layout,
fixed labels, action ids, and binding names. The CMS content document supplies
copy and game-object references for those bindings. The renderer combines them
at runtime through host-owned resolvers.

## Boundary

UI template owns:

- node tree and component type
- layout and surface/material ids
- fixed UI copy such as `View Contract`
- action ids such as `viewContract`
- content binding names such as `mission.body`
- content render mode such as `plain`, `rich`, or `auto`
- action binding names such as `mission.viewTarget`

CMS content owns:

- mission-specific copy
- localized strings
- badges, sector labels, reward values
- game entity ids and safe action targets
- content version/provenance

The CMS never sends functions, HTML, CSS, or executable action names outside the
client allowlist.

CMS strings may use the approved material rich-text markup grammar already used
by the editor, e.g. `[h1]`, `[h2]`, `[accent]`, `[RULE]`, and `[DIVIDER]`.
The UI template must opt a binding into rich rendering via `contentMode:
"rich"` or `"auto"`; otherwise CMS text is rendered literally.

## Theme / Global Defaults

The next contract layer should be a host-owned theme block, not per-CMS styles.
That block can define approved global defaults for a template family:

- base text font
- rich text tag tones/sizes/weights
- default material skin id
- spacing scale

For now, `/ui-node` demonstrates this as client-owned CSS variables applied to
the mission briefing template. The important rule is the same: CMS supplies
content and safe targets; the client/template owns fonts, colors, and styling.

## Example

Template:

```json
{
  "id": "mission-briefing",
  "type": "panel",
  "materialId": "mission-panel",
  "children": [
    { "id": "mission-title", "type": "text", "contentBinding": "mission.title" },
    {
      "id": "mission-copy",
      "type": "text",
      "contentBinding": "mission.briefing",
      "contentMode": "rich"
    },
    {
      "id": "mission-cta",
      "type": "button",
      "text": "View Contract",
      "action": {
        "id": "viewContract",
        "targetBinding": "mission.viewTarget"
      }
    }
  ]
}
```

CMS content:

```json
{
  "mission.title": "Data Extraction",
  "mission.viewTarget": { "kind": "contract", "id": "contract_solace_mainframe" }
}
```

## Runtime Rule

`renderUiNodeToSolid(template, context)` resolves bindings. Actions remain
client-owned:

```ts
onAction({ id: 'viewContract', target: { kind: 'contract', id: 'contract_solace_mainframe' } })
```

The game engine decides what `viewContract` means. The CMS only supplies the
safe target data.
