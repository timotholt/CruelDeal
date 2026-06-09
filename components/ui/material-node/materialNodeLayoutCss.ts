import type { JSX } from 'solid-js';
import type { MaterialNodeLayout } from './MaterialNodeTypes';

// Compile a MaterialNodeLayout into self-sufficient inline CSS.
//
// "Self-sufficient" means the result does not depend on any external stylesheet
// rule (e.g. a host's `.card-node { position: absolute }` class) to position or
// size the node. This lets the canonical MaterialNodeRenderer lay out a node tree
// correctly on its own, including when a host bakes positioning into `layout.style`.
//
// `display: 'absolute'` is a positioning intent, not a CSS `display` value: it
// compiles to `position: absolute` plus a flex column box model so children flow or
// position inside the node. Other `display` values pass through unchanged.
//
// Precedence (low -> high): base box model -> `layout.style` (host-baked CSS) ->
// explicit structured fields. An *undefined* structured field never clobbers a value
// already present in `layout.style`.
export const materialNodeLayoutCss = (
  layout?: MaterialNodeLayout,
): JSX.CSSProperties | undefined => {
  if (!layout) return undefined;

  const isAbsolute = layout.display === 'absolute';

  // Base box model — only emitted for nodes that own a flex/positioned box, so
  // plain `block`/`grid`/unset nodes are untouched (additive for existing consumers).
  const base: Record<string, string> = {};
  if (isAbsolute) {
    base.position = 'absolute';
    base.display = 'flex';
    base['flex-direction'] = layout.direction === 'row' ? 'row' : 'column';
    base['box-sizing'] = 'border-box';
    base['min-width'] = '0';
    base['min-height'] = '0';
  }

  const explicit: Record<string, string | undefined> = {
    // display/flex-direction already handled by `base` for the absolute case.
    display: isAbsolute ? undefined : layout.display,
    'flex-direction': isAbsolute ? undefined : layout.direction,
    'align-items': layout.align,
    'justify-content': layout.justify,
    gap: layout.gap === undefined ? undefined : `${layout.gap}px`,
    padding: layout.padding === undefined ? undefined : `${layout.padding}px`,
    width: layout.width,
    height: layout.height,
    'min-width': layout.minWidth,
    'min-height': layout.minHeight,
    left: layout.position?.left,
    right: layout.position?.right,
    top: layout.position?.top,
    bottom: layout.position?.bottom,
    inset: layout.position?.inset,
  };
  const defined = Object.fromEntries(
    Object.entries(explicit).filter(([, v]) => v !== undefined),
  );

  return { ...base, ...(layout.style ?? {}), ...defined } as JSX.CSSProperties;
};
