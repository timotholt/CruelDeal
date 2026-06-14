import type { JSX } from 'solid-js';

export type FeedNodeLayoutMode = 'absolute' | 'flow';
export type FeedNodeLayoutSlot = 'auto' | 'body' | 'footer' | 'overlay';
export type FeedNodeAlign = 'left' | 'center' | 'right';
export type FeedNodeJustify = 'start' | 'center' | 'end';
export type FeedNodeDirection = 'row' | 'column';
export type FeedNodeDistribute = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type FeedNodeCrossAlign = 'start' | 'center' | 'end' | 'stretch';
export type FeedNodeSizeMode = 'fixed' | 'hug' | 'fill';
export type FeedNodeSelfPosition = 'in-flow' | 'absolute';
export type FeedNodeConstraintH = 'left' | 'right' | 'left-right' | 'center' | 'scale';
export type FeedNodeConstraintV = 'top' | 'bottom' | 'top-bottom' | 'center' | 'scale';

export interface FeedNodeLayout {
  mode: FeedNodeLayoutMode;
  slot: FeedNodeLayoutSlot;
  x: number;
  y: number;
  width: number;
  height: number;
  nudgeX: number;
  nudgeY: number;
  padding: number;
  gap: number;
  align: FeedNodeAlign;
  justify: FeedNodeJustify;
  direction?: FeedNodeDirection;
  reverse?: boolean;
  wrap?: boolean;
  distribute?: FeedNodeDistribute;
  crossAlign?: FeedNodeCrossAlign;
  wMode?: FeedNodeSizeMode;
  hMode?: FeedNodeSizeMode;
  selfPosition?: FeedNodeSelfPosition;
  pushToEnd?: boolean;
  constraintH?: FeedNodeConstraintH;
  constraintV?: FeedNodeConstraintV;
}

export interface FeedNodeLayoutCssOptions {
  forcePaddingVar?: boolean;
}

export const resolveLayoutDirection = (l: FeedNodeLayout): FeedNodeDirection => l.direction ?? 'column';
export const resolveLayoutDistribute = (l: FeedNodeLayout): FeedNodeDistribute =>
  l.distribute ?? (l.justify === 'start' ? 'start' : l.justify === 'end' ? 'end' : 'center');
export const resolveLayoutCrossAlign = (l: FeedNodeLayout): FeedNodeCrossAlign =>
  l.crossAlign ?? (l.align === 'left' ? 'start' : l.align === 'right' ? 'end' : 'center');
export const resolveLayoutWMode = (l: FeedNodeLayout): FeedNodeSizeMode => l.wMode ?? 'fixed';
export const resolveLayoutHMode = (l: FeedNodeLayout): FeedNodeSizeMode => l.hMode ?? 'fixed';
export const resolveLayoutSelfPosition = (l: FeedNodeLayout): FeedNodeSelfPosition =>
  l.selfPosition ?? (l.mode === 'flow' && l.slot !== 'overlay' ? 'in-flow' : 'absolute');
export const resolveLayoutPushToEnd = (l: FeedNodeLayout): boolean => l.pushToEnd ?? l.slot === 'footer';

const distributeToJustifyContent = (d: FeedNodeDistribute): string =>
  d === 'start' ? 'flex-start'
    : d === 'end' ? 'flex-end'
    : d === 'between' ? 'space-between'
    : d === 'around' ? 'space-around'
    : d === 'evenly' ? 'space-evenly'
    : 'center';
const crossAlignToAlignItems = (c: FeedNodeCrossAlign): string =>
  c === 'start' ? 'flex-start' : c === 'end' ? 'flex-end' : c === 'stretch' ? 'stretch' : 'center';

export const resolveLayoutConstraintH = (l: FeedNodeLayout): FeedNodeConstraintH => l.constraintH ?? 'left';
export const resolveLayoutConstraintV = (l: FeedNodeLayout): FeedNodeConstraintV => l.constraintV ?? 'top';

const absoluteConstraintCss = (layout: FeedNodeLayout, wMode: FeedNodeSizeMode, hMode: FeedNodeSizeMode) => {
  const h = resolveLayoutConstraintH(layout);
  const v = resolveLayoutConstraintV(layout);
  const rightFromLegacyBox = 100 - layout.x - layout.width;
  const bottomFromLegacyBox = 100 - layout.y - layout.height;
  const css: JSX.CSSProperties = {};
  const transforms: string[] = [];

  if (h === 'right') {
    css.right = `${layout.x}%`;
  } else if (h === 'left-right') {
    css.left = `${layout.x}%`;
    css.right = `${rightFromLegacyBox}%`;
  } else if (h === 'center') {
    css.left = `calc(50% + ${layout.x}%)`;
    transforms.push('translateX(-50%)');
  } else {
    css.left = `${layout.x}%`;
  }

  if (v === 'bottom') {
    css.bottom = `${layout.y}%`;
  } else if (v === 'top-bottom') {
    css.top = `${layout.y}%`;
    css.bottom = `${bottomFromLegacyBox}%`;
  } else if (v === 'center') {
    css.top = `calc(50% + ${layout.y}%)`;
    transforms.push('translateY(-50%)');
  } else {
    css.top = `${layout.y}%`;
  }

  if (h !== 'left-right') {
    css.width = wMode === 'hug' ? 'max-content' : wMode === 'fill' ? '100%' : `${layout.width}%`;
  }
  if (v !== 'top-bottom') {
    css.height = hMode === 'hug' ? 'auto' : hMode === 'fill' ? '100%' : `${layout.height}%`;
  }

  return { css, transforms };
};

type FeedNodeCssMap = Record<string, string | number>;

const setFeedNodeCss = (
  css: JSX.CSSProperties,
  key: string,
  value: string | number | undefined | null | false,
) => {
  if (value === undefined || value === null || value === false || value === '') return;
  (css as FeedNodeCssMap)[key] = value;
};

const emitLayoutPositionCss = (css: JSX.CSSProperties, inFlow: boolean) => {
  if (inFlow) setFeedNodeCss(css, 'position', 'relative');
};

const emitLayoutSizeCss = (
  css: JSX.CSSProperties,
  layout: FeedNodeLayout,
  inFlow: boolean,
  wMode: FeedNodeSizeMode,
  hMode: FeedNodeSizeMode,
) => {
  if (!inFlow) return;
  setFeedNodeCss(css, 'width', wMode === 'hug' ? 'max-content' : wMode === 'fill' ? 'auto' : `${layout.width}%`);
  setFeedNodeCss(css, 'height', hMode === 'hug' ? 'auto' : hMode === 'fill' ? 'auto' : `${layout.height}%`);
};

const emitLayoutFlexCss = (
  css: JSX.CSSProperties,
  layout: FeedNodeLayout,
  direction: FeedNodeDirection,
) => {
  const flexDirection = direction === 'row'
    ? (layout.reverse ? 'row-reverse' : 'row')
    : (layout.reverse ? 'column-reverse' : undefined);
  setFeedNodeCss(css, 'flex-direction', flexDirection);
  setFeedNodeCss(css, 'flex-wrap', layout.wrap ? 'wrap' : undefined);
  setFeedNodeCss(css, 'text-align', layout.align);
  setFeedNodeCss(css, 'align-items', crossAlignToAlignItems(resolveLayoutCrossAlign(layout)));
  setFeedNodeCss(css, 'justify-content', distributeToJustifyContent(resolveLayoutDistribute(layout)));
};

const emitLayoutSpacingCss = (
  css: JSX.CSSProperties,
  layout: FeedNodeLayout,
  direction: FeedNodeDirection,
  options: FeedNodeLayoutCssOptions,
) => {
  const gap = layout.gap || 0;
  const padding = layout.padding || 0;
  const pushToEnd = resolveLayoutPushToEnd(layout);
  setFeedNodeCss(css, 'margin-top', pushToEnd && direction === 'column' ? 'auto' : undefined);
  setFeedNodeCss(css, 'margin-left', pushToEnd && direction === 'row' ? 'auto' : undefined);
  setFeedNodeCss(css, 'gap', gap !== 0 ? `${gap}px` : undefined);
  setFeedNodeCss(css, '--feed-node-gap', gap !== 0 ? `${gap}px` : undefined);
  setFeedNodeCss(css, '--feed-node-gap-scale', gap !== 0 ? `${gap / 100}` : undefined);
  setFeedNodeCss(css, '--feed-node-padding', padding !== 0 || options.forcePaddingVar ? `${padding}px` : undefined);
};

const emitLayoutTransformCss = (css: JSX.CSSProperties, transforms: string) => {
  setFeedNodeCss(css, 'transform', transforms);
};

export const feedNodeLayoutCss = (layout: FeedNodeLayout, options: FeedNodeLayoutCssOptions = {}): JSX.CSSProperties => {
  const inFlow = resolveLayoutSelfPosition(layout) === 'in-flow';
  const legacyFlow = layout.mode === 'flow';
  const direction = resolveLayoutDirection(layout);
  const wMode = resolveLayoutWMode(layout);
  const hMode = resolveLayoutHMode(layout);
  const absolute = inFlow ? undefined : absoluteConstraintCss(layout, wMode, hMode);
  const transforms = [
    ...(absolute?.transforms ?? []),
    legacyFlow && (layout.nudgeX || layout.nudgeY) ? `translate(${layout.nudgeX}px, ${layout.nudgeY}px)` : undefined,
  ].filter(Boolean).join(' ');
  const css: JSX.CSSProperties = {};
  emitLayoutPositionCss(css, inFlow);
  Object.assign(css, absolute?.css ?? {});
  emitLayoutSizeCss(css, layout, inFlow, wMode, hMode);
  emitLayoutFlexCss(css, layout, direction);
  emitLayoutSpacingCss(css, layout, direction, options);
  emitLayoutTransformCss(css, transforms);
  return css;
};
