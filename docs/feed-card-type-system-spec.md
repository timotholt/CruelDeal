# Feed Card Type System

## Goal

The Material Lab feed should preview server-driven stories without becoming a content management tool. Story copy is mock server data. Visual styling is authored in the lab through reusable card types.

## Runtime Model

Server stories provide content and choose a visual type:

```ts
interface FeedStory {
  id: string;
  label: string;
  cardTypeId: "card_type_01" | "card_type_02" | "card_type_03";
  image: string;
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  ctaLabel: string;
}
```

Card types provide presentation. A card type is a generic tree, not a feed-specific fixed layout:

```ts
interface FeedCardTypeRecipe {
  id: "card_type_01" | "card_type_02" | "card_type_03";
  name: string;
  description: string;
  surface: MaterialRecipe;
  backgroundImage: FeedBackgroundImageRecipe;
  children: FeedCardNode[];
}

interface FeedBackgroundImageRecipe {
  binding: "image";
  enabled: boolean;
  fit: "cover" | "contain";
  x: number;
  y: number;
  scale: number;
  fadeMode: "none" | "top-dark" | "bottom-dark" | "left-dark" | "right-dark" | "left-bottom-dark" | "top-bottom-dark" | "vignette-dark" | "left-light" | "top-light" | "bottom-light";
  fadeStrength: number;
  fadeSize: number;
}

interface FeedCardNode {
  id: string;
  label: string;
  type: "container" | "text" | "button";
  binding?: "eyebrow" | "title" | "body" | "meta" | "ctaLabel";
  layout: FeedNodeLayout;
  surface?: MaterialRecipe;
  text?: FeedTextSlotStyle;
  children?: FeedCardNode[];
}
```

The render path is:

```txt
FeedStory content + FeedStory.cardTypeId -> FeedCardTypeRecipe -> rendered slide
```

## Text Inheritance

Each card type has a Base Text style stored on its `surface` material recipe. Every text slot can either inherit from Base Text or override basic typography.

Cascade:

```txt
Card Type Base Text
-> Node text override, unless node.text.inherit is true
```

This keeps the lab simple:

- Base Text controls set the default font, size, color, weight, style, case, tracking, and alignment.
- Text and button nodes can opt into inherit or provide their own basic text style.
- Actual story text stays in mock server data and is not edited through Base Text content.

## Background Image

The root card supports a dumb full-bleed bitmap layer for server-driven art. It is not the material texture slot, and it should not render a second visual frame over the image.

The background image layer places media and provides readability fades:

```txt
fit, x, y, scale, fadeMode, fadeStrength, fadeSize
```

Opacity, blur, tint, stone/glass texture, and other surface treatment remain material responsibilities. Readability fades stay with the media layer because they depend on the image composition. This keeps the separation clear:

- Bitmap layer: place the story art.
- Fade layer: keep copy readable over full-bleed art.
- Root canvas: stays neutral and owns no material surface.
- Child nodes: lay out and style text, buttons, and nested containers.

## Node Tree

The carousel renders card trees recursively. The default allowed node types are intentionally small:

- `container`: a material-editable layout region that can have children.
- `text`: a server-bound text node with its own `MaterialRecipe` surface.
- `button`: a server-bound CTA node with its own `MaterialRecipe` surface.

Every visible node is a material-capable child. A text label can therefore be plain text, glass over image, a bordered chip, an inset panel, or any other material recipe. The server still provides the text value; the card type owns the child material surface and layout.

Rendering keeps node responsibilities separate:

```txt
FeedNodeFrame
  owns x, y, width, height, padding, gap, align, justify
MaterialSurface or MaterialButton
  owns material, texture, tint, gradient, glass, border, edge wear, text recipe
NodeContent
  owns the bound story value such as title, body, meta, or ctaLabel
```

No node type passes layout styles into a material primitive. A CTA button, text panel, and container all get the same outer frame, so layout sliders behave identically across node kinds.

The first build supports bounded defaults rather than arbitrary authoring:

- Each default card type ships with a root background image and a small child tree.
- The lab can select a node and adjust its box: x, y, width, height, padding, gap, alignment, and justification.
- More node creation/removal can come later once the runtime model feels right.

## Editor Layout

When Feed is selected:

- `Fake Server` chooses which mock story is previewed.
- The left parts pane expands Feed into a card type tree: `Feed Card 1`, `Feed Card 2`, `Feed Card 3`, each with its own child containers, text nodes, and button nodes.
- The root feed-card target edits story selection, bitmap placement, and carousel-level layout.
- The normal material controls edit whichever child target is selected in that left tree.
- Selecting a feed card or child on the left also selects a matching mock story so the edited card type is visible in the carousel.
- `Card Image` edits the root bitmap placement only when the selected target is the feed card root.
- `Selected Node` edits the selected child layout box when the target is a node.
- Text and button nodes expose a simple `inherit/custom` switch. In inherit mode, Base Text is disabled and the node uses card type defaults. In custom mode, the selected node's Base Text controls edit only that node.
- `Feed Layout` keeps carousel-level layout controls: Content Y, Copy Lift, and Dot Gap. It is shown only for card-root editing, not child-node editing.

## Material Target Tree

The feed editor should not own a separate copy of material controls. It adapts feed card data into the same target shape used by the workbench:

```ts
interface MaterialEditableTarget {
  id: string;
  label: string;
  recipe: MaterialRecipe;
  capabilities: MaterialEditorCapabilities;
  onChange: (recipe: MaterialRecipe) => void;
  children?: MaterialEditableTarget[];
}
```

This lets a child glass region, text chip, or CTA button all use the exact same `MaterialRecipeEditor` path. The feed root is the exception by design: it is a neutral media canvas, so it exposes media controls instead of inactive material sliders.

## Current Fake Server Types

- `card_type_01`: promo or limited-time event.
- `card_type_02`: patch notes or system update.
- `card_type_03`: community or competitive news.

## Real Server Swap

The real API only needs to return `FeedStory[]` with stable `cardTypeId` values. The lab-authored card type recipes can remain local design data, ship as app config, or be fetched separately later.

No runtime content system should depend on the Material Lab editor controls.
