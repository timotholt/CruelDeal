import type { JSX } from 'solid-js';
import type { MaterialSurfaceHostKind } from './MaterialSurfaceHost';
import type { UiLayoutPayload, UiNodeType } from './uiNodeValidate';

// Pure presentation logic for UiNodePayload -> surface. Kept JSX-free so it is
// unit-testable without a DOM; UiNode.tsx is the thin Solid shell over it.

const ALIGN: Record<NonNullable<UiLayoutPayload['align']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const JUSTIFY: Record<NonNullable<UiLayoutPayload['justify']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

/** Map the bounded UiLayoutPayload to a CSS style object. */
export const uiLayoutToStyle = (layout?: UiLayoutPayload): JSX.CSSProperties | undefined => {
  if (!layout) return undefined;
  const style: Record<string, string> = {};
  if (layout.display === 'absolute') style.position = 'absolute';
  else if (layout.display) style.display = layout.display;
  if (layout.direction) style['flex-direction'] = layout.direction;
  if (layout.align) style['align-items'] = ALIGN[layout.align];
  if (layout.justify) style['justify-content'] = JUSTIFY[layout.justify];
  if (layout.gap !== undefined) style.gap = `${layout.gap}px`;
  if (layout.padding !== undefined) style.padding = `${layout.padding}px`;
  if (layout.width) style.width = layout.width;
  if (layout.height) style.height = layout.height;
  if (layout.minWidth) style['min-width'] = layout.minWidth;
  if (layout.minHeight) style['min-height'] = layout.minHeight;
  const p = layout.position;
  if (p) {
    if (p.left) style.left = p.left;
    if (p.right) style.right = p.right;
    if (p.top) style.top = p.top;
    if (p.bottom) style.bottom = p.bottom;
    if (p.inset) style.inset = p.inset;
  }
  return style as JSX.CSSProperties;
};

/**
 * Which surface host a node type renders through.
 *  - button       -> interactive button surface
 *  - panel        -> panel surface
 *  - text/image   -> panel when a skin is set, otherwise a bare element
 *  - slot         -> bare (children-only placeholder)
 */
export const surfaceKindForType = (type: UiNodeType, hasSurface: boolean): MaterialSurfaceHostKind => {
  if (type === 'button') return 'button';
  if (type === 'panel') return 'panel';
  if ((type === 'text' || type === 'image') && hasSurface) return 'panel';
  return 'bare';
};
