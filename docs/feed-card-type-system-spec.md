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
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
}
```

Card types provide presentation:

```ts
interface FeedCardTypeRecipe {
  id: "card_type_01" | "card_type_02" | "card_type_03";
  name: string;
  description: string;
  surface: MaterialRecipe;
  slots: {
    eyebrow: FeedTextSlotStyle;
    title: FeedTextSlotStyle;
    body: FeedTextSlotStyle;
    meta: FeedTextSlotStyle;
  };
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
-> Slot override, unless slot.inherit is true
```

This keeps the lab simple:

- Base Text controls set the default font, size, color, weight, style, case, tracking, and alignment.
- Header, Title, Body, and Meta can opt into inherit or provide their own basic text style.
- Actual story text stays in mock server data and is not edited through Base Text content.

## Editor Layout

When Feed is selected:

- `Fake Server` chooses which mock story is previewed.
- `Card Type` chooses which reusable visual recipe is being edited.
- The normal material controls edit that card type surface.
- `Feed Text Slots` edits Header, Title, Body, and Meta style overrides.
- `Feed Layout` keeps carousel-level layout controls: Content Y, Copy Lift, and Dot Gap.

## Current Fake Server Types

- `card_type_01`: promo or limited-time event.
- `card_type_02`: patch notes or system update.
- `card_type_03`: community or competitive news.

## Real Server Swap

The real API only needs to return `FeedStory[]` with stable `cardTypeId` values. The lab-authored card type recipes can remain local design data, ship as app config, or be fetched separately later.

No runtime content system should depend on the Material Lab editor controls.
