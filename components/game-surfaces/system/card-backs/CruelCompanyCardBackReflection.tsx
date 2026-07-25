import { createUniqueId } from 'solid-js';
import {
  CARD_BACK_HEIGHT,
  CARD_BACK_VIEW_BOX,
  CARD_BACK_WIDTH,
  CardBackGoldMaskContent,
} from './ProceduralCardBackPrimitives';
import type { CardBackReflectionProps } from './cardBackTypes';

export const CruelCompanyCardBackReflection = (props: CardBackReflectionProps) => {
  const uid = createUniqueId();
  const id = (name: string) => `${uid}-${name}`;

  return (
    <svg
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={CARD_BACK_VIEW_BOX}
      width={CARD_BACK_WIDTH}
      height={CARD_BACK_HEIGHT}
      aria-hidden="true"
    >
      <defs>
        <mask id={id('gold-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1400">
          <rect width="1000" height="1400" fill="#000" />
          <CardBackGoldMaskContent
            font={props.font}
            emblemFont={props.emblemFont}
            caption={props.caption}
            emblem={props.emblem}
            microTextA={props.microTextA}
            microTextB={props.microTextB}
            typography={props.typography}
            paint="#fff"
            structuralGold={props.layers.structuralGold}
            identity={props.layers.identity}
            relief={props.relief}
          />
        </mask>
        <linearGradient id={id('film')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0" />
          <stop offset="0.33" stop-color="#f4c867" stop-opacity="0.08" />
          <stop offset="0.49" stop-color="#fffbe8" stop-opacity="0.72" />
          <stop offset="0.58" stop-color="#d69c39" stop-opacity="0.24" />
          <stop offset="0.76" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g mask={`url(#${id('gold-mask')})`}>
        <rect
          class="card-back-material__reflection-film"
          x="-650"
          y="-300"
          width="2300"
          height="2000"
          fill={`url(#${id('film')})`}
          transform="rotate(-22 500 700)"
        />
      </g>
    </svg>
  );
};
