import { createUniqueId } from 'solid-js';
import {
  CARD_BACK_HEIGHT,
  CARD_BACK_VIEW_BOX,
  CARD_BACK_WIDTH,
  CardBackGoldMaskContent,
} from './ProceduralCardBackPrimitives';
import type { CardBackReflectionProps } from './cardBackTypes';

/** Static metal finish, separate from both baked artwork and moving light. */
export const CruelCompanyCardBackFinish = (props: CardBackReflectionProps) => {
  const uid = createUniqueId();
  const gold = `${uid}-gold-finish`;
  const mask = `${uid}-gold-mask`;

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
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1400">
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
        <linearGradient id={gold} x1="120" y1="40" x2="900" y2="1350" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#5e3c16" />
          <stop offset="0.2" stop-color="#f3d993" />
          <stop offset="0.34" stop-color="#8c5e24" />
          <stop offset="0.62" stop-color="#e2bb6b" />
          <stop offset="0.76" stop-color="#fff0b5" />
          <stop offset="1" stop-color="#68471c" />
        </linearGradient>
      </defs>
      <rect width="1000" height="1400" fill={`url(#${gold})`} mask={`url(#${mask})`} />
    </svg>
  );
};
