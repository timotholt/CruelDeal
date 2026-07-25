import { For } from "solid-js";
import type { CardBackCopy, CardBackFont, CardBackRelief, CardBackTextPlacement, CardBackTypography } from './cardBackTypes';
import { DEFAULT_CARD_BACK_TYPOGRAPHY } from './cardBackTypes';
import { getCardBackTextLayout } from './cardBackTypeface';
export type { CardBackCopy } from './cardBackTypes';

export const CARD_BACK_VIEW_BOX = '0 0 1000 1400';
export const CARD_BACK_WIDTH = 1000;
export const CARD_BACK_HEIGHT = 1400;

interface CruelCompanyMarkProps extends Pick<CardBackCopy, 'emblem'> {
  font: CardBackFont;
  paint: string;
  placement: CardBackTextPlacement;
}

/** Center identity is real type geometry, shared by SVG masks and Three.js. */
export const CruelCompanyMark = (props: CruelCompanyMarkProps) => {
  const placement = () => props.placement ?? DEFAULT_CARD_BACK_TYPOGRAPHY.emblem;
  const layout = () => getCardBackTextLayout(
    props.font,
    props.emblem,
    placement().size,
    500 + placement().x,
    785 + placement().y,
    'center',
    placement().spacing,
  );
  return (
    <path
      data-card-back-emblem={props.emblem}
      d={layout().pathData}
      transform={layout().transform}
      fill={props.paint}
      fill-rule="evenodd"
    />
  );
};

interface GoldGeometryProps extends CardBackCopy {
  font: CardBackFont;
  emblemFont: CardBackFont;
  typography: CardBackTypography;
  paint: string;
  filter?: string;
}

export const CardBackIdentityGeometry = (props: GoldGeometryProps) => {
  const typography = () => props.typography ?? DEFAULT_CARD_BACK_TYPOGRAPHY;
  return (
  <g filter={props.filter}>
    <CruelCompanyMark font={props.emblemFont} emblem={props.emblem} paint={props.paint} placement={typography().emblem} />
    <path
      data-card-back-text={props.caption}
      d={getCardBackTextLayout(props.font, props.caption, typography().caption.size, 500 + typography().caption.x, 202 + typography().caption.y, 'center', typography().caption.spacing).pathData}
      transform={getCardBackTextLayout(props.font, props.caption, typography().caption.size, 500 + typography().caption.x, 202 + typography().caption.y, 'center', typography().caption.spacing).transform}
      fill={props.paint}
      fill-rule="evenodd"
    />
    <path
      data-card-back-text={props.microTextA}
      d={getCardBackTextLayout(props.font, props.microTextA, 17, 90, 1305, 'left').pathData}
      transform={getCardBackTextLayout(props.font, props.microTextA, 17, 90, 1305, 'left').transform}
      fill={props.paint}
      fill-rule="evenodd"
    />
    <path
      data-card-back-text={props.microTextB}
      d={getCardBackTextLayout(props.font, props.microTextB, 17, 790, 1305, 'right').pathData}
      transform={getCardBackTextLayout(props.font, props.microTextB, 17, 790, 1305, 'right').transform}
      fill={props.paint}
      fill-rule="evenodd"
    />
  </g>
  );
};

export const CardBackIdentityMaskContent = (props: GoldGeometryProps) => (
  <g filter={props.filter}>
    <g>
      <For each={CARD_BACK_IDENTITY_DISCS}>{disc => (
        <g>
          <circle cx={disc.x} cy={disc.y} r={disc.radius} fill={props.paint} />
          <circle cx={disc.x} cy={disc.y} r={disc.radius - 10} fill="none" stroke={props.paint} stroke-width="4" opacity="0.7" />
        </g>
      )}</For>
    </g>
    <CardBackIdentityGeometry {...props} filter={undefined} />
  </g>
);

export const CARD_BACK_IDENTITY_DISCS = [
  { x: 128, y: 151, radius: 38 },
  { x: 872, y: 1249, radius: 38 },
] as const;

interface StructuralGeometryProps extends Pick<GoldGeometryProps, 'paint'> {
  relief: Pick<CardBackRelief, 'outerBorderWidth' | 'railWidth' | 'hexWidth'>;
  widthOffset?: number;
  includePerimeter?: boolean;
  curveRadius?: number;
}

export const CARD_BACK_PERIMETER_PATH = {
  d: 'M57 7H943Q993 7 993 57V1343Q993 1393 943 1393H57Q7 1393 7 1343V57Q7 7 57 7Z',
  width: 14,
} as const;

type Point = readonly [number, number];

const point = (value: number) => Number(value.toFixed(2));
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const toward = (from: Point, to: Point, amount: number): Point => {
  const length = distance(from, to) || 1;
  return [from[0] + (to[0] - from[0]) * amount / length, from[1] + (to[1] - from[1]) * amount / length];
};
const commandPoint = (prefix: string, value: Point) => `${prefix}${point(value[0])} ${point(value[1])}`;

/** Converts authored polyline corners into registered quadratic Bézier bends. */
const roundedPolyline = (points: readonly Point[], requestedRadius: number, closed = false) => {
  if (points.length < 2) return '';
  const radius = Math.max(0, requestedRadius);
  if (radius === 0) {
    return `${commandPoint('M', points[0])}${points.slice(1).map(value => commandPoint('L', value)).join('')}${closed ? 'Z' : ''}`;
  }
  const corner = (index: number) => {
    const current = points[index];
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const offset = Math.min(radius, distance(current, previous) * 0.45, distance(current, next) * 0.45);
    return {
      approach: toward(current, previous, offset),
      current,
      exit: toward(current, next, offset),
    };
  };

  if (closed) {
    const first = corner(0);
    let path = commandPoint('M', first.exit);
    for (let index = 1; index < points.length; index += 1) {
      const bend = corner(index);
      path += commandPoint('L', bend.approach);
      path += `Q${point(bend.current[0])} ${point(bend.current[1])} ${point(bend.exit[0])} ${point(bend.exit[1])}`;
    }
    path += commandPoint('L', first.approach);
    return `${path}Q${point(first.current[0])} ${point(first.current[1])} ${point(first.exit[0])} ${point(first.exit[1])}Z`;
  }

  let path = commandPoint('M', points[0]);
  for (let index = 1; index < points.length - 1; index += 1) {
    const bend = corner(index);
    path += commandPoint('L', bend.approach);
    path += `Q${point(bend.current[0])} ${point(bend.current[1])} ${point(bend.exit[0])} ${point(bend.exit[1])}`;
  }
  return `${path}${commandPoint('L', points[points.length - 1])}`;
};

export const getCardBackInternalPaths = (curveRadius = 0) => [
  {
    d: [
      roundedPolyline([[188, 49], [188, 235], [353, 471], [353, 524]], curveRadius),
      roundedPolyline([[812, 49], [812, 235], [647, 471], [647, 524]], curveRadius),
      roundedPolyline([[274, 330], [726, 330]], curveRadius),
    ].join(''),
    width: 12,
    role: 'rail',
  },
  {
    d: [
      roundedPolyline([[45, 403], [154, 516], [154, 895], [45, 1002]], curveRadius),
      roundedPolyline([[955, 403], [846, 516], [846, 895], [955, 1002]], curveRadius),
    ].join(''),
    width: 16,
    role: 'rail',
  },
  {
    d: [
      roundedPolyline([[154, 895], [376, 1111], [486, 1113], [497, 1125], [497, 1400]], curveRadius),
      roundedPolyline([[846, 895], [624, 1111], [514, 1113], [503, 1125], [503, 1400]], curveRadius),
    ].join(''),
    width: 13,
    role: 'rail',
  },
  {
    d: roundedPolyline([[500, 416], [740, 553], [740, 824], [500, 961], [260, 824], [260, 553]], curveRadius, true),
    width: 18,
    role: 'hex',
  },
] as const;

export const CARD_BACK_INTERNAL_PATHS = getCardBackInternalPaths();

/** Canonical structure used by both the recessed channels and metal inserts. */
export const CardBackStructuralGeometry = (props: StructuralGeometryProps) => {
  const width = (base: number, role: 'perimeter' | 'rail' | 'hex') => {
    const authored = role === 'perimeter'
      ? props.relief.outerBorderWidth
      : role === 'hex'
        ? props.relief.hexWidth
        : base + props.relief.railWidth - 14;
    return Math.max(1, authored + (props.widthOffset ?? 0));
  };

  return (
  <g
    fill="none"
    stroke={props.paint}
    stroke-linecap="butt"
    stroke-linejoin="bevel"
  >
    {props.includePerimeter !== false ? (
      <path
        d={CARD_BACK_PERIMETER_PATH.d}
        stroke-width={width(CARD_BACK_PERIMETER_PATH.width, 'perimeter')}
      />
    ) : null}
    <For each={getCardBackInternalPaths(props.curveRadius)}>{path => (
      <path data-card-back-structure={path.role} d={path.d} stroke-width={width(path.width, path.role)} />
    )}</For>
  </g>
  );
};

/** Metal, finish, and reflection all consume the canonical structural paths. */
export const CardBackStructuralGoldMaskContent = (props: Pick<GoldGeometryProps, 'paint'> & { relief: CardBackRelief }) => (
  <CardBackStructuralGeometry paint={props.paint} relief={props.relief} curveRadius={props.relief.curveRadius} />
);

interface GoldMaskContentProps extends GoldGeometryProps {
  structuralGold?: boolean;
  identity?: boolean;
  relief: CardBackRelief;
}

/** Structural gold and editable identity share one finish/reflection mask. */
export const CardBackGoldMaskContent = (props: GoldMaskContentProps) => (
  <g filter={props.filter}>
    {props.structuralGold !== false ? <CardBackStructuralGoldMaskContent paint={props.paint} relief={props.relief} /> : null}
    {props.identity !== false ? <CardBackIdentityMaskContent {...props} filter={undefined} /> : null}
  </g>
);
