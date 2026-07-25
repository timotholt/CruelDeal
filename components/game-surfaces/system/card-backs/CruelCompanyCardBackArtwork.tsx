import { createUniqueId } from 'solid-js';
import type { CardBackArtworkProps } from './cardBackTypes';
import {
  CARD_BACK_HEIGHT,
  CARD_BACK_VIEW_BOX,
  CARD_BACK_WIDTH,
  CardBackIdentityMaskContent,
  CardBackStructuralGeometry,
  CardBackStructuralGoldMaskContent,
} from './ProceduralCardBackPrimitives';

const SOURCE_ART = {
  onyx: '/art/card-backs/cruel-company-substrate-onyx-albedo-v5.png',
  ivory: '/art/card-backs/cruel-company-substrate-ivory-albedo-v5.png',
} as const;
const GOLD_MATERIAL = '/art/card-backs/cruel-company-gold-material-v1.png';

export const CruelCompanyCardBackArtwork = (props: CardBackArtworkProps) => {
  const uid = createUniqueId();
  const id = (name: string) => `${uid}-${name}`;
  const source = () => SOURCE_ART[props.variant];

  return (
    <svg
      ref={props.ref}
      class={`procedural-card-back-art${props.class ? ` ${props.class}` : ''}`}
      data-card-back-artwork="cruel-company"
      data-card-back-variant={props.variant}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={CARD_BACK_VIEW_BOX}
      width={CARD_BACK_WIDTH}
      height={CARD_BACK_HEIGHT}
      role={props.title ? 'img' : undefined}
      aria-label={props.title}
    >
      {props.title ? <title>{props.title}</title> : null}
      <defs>
        <mask id={id('structural-gold-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1400">
          <rect width="1000" height="1400" fill="#000" />
          <CardBackStructuralGoldMaskContent paint="#fff" relief={props.relief} />
        </mask>
        <mask id={id('identity-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1400">
          <rect width="1000" height="1400" fill="#000" />
          <CardBackIdentityMaskContent
            font={props.font}
            emblemFont={props.emblemFont}
            caption={props.caption}
            emblem={props.emblem}
            microTextA={props.microTextA}
            microTextB={props.microTextB}
            typography={props.typography}
            paint="#fff"
          />
        </mask>
        <filter id={id('gold-relief')} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity="0.72" />
          <feDropShadow dx="-1" dy="-1" stdDeviation="0.6" flood-color="#fff2bd" flood-opacity="0.38" />
        </filter>
        <filter
          id={id('groove-relief')}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          color-interpolation-filters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="groove-height" />
          <feDiffuseLighting
            in="groove-height"
            surfaceScale="-7"
            diffuseConstant="0.82"
            lighting-color="#fff2cf"
            result="groove-light"
          >
            <feDistantLight azimuth="315" elevation="52" />
          </feDiffuseLighting>
          <feComposite in="groove-light" in2="SourceAlpha" operator="in" result="clipped-light" />
          <feComponentTransfer in="clipped-light" result="restrained-light">
            <feFuncR type="linear" slope="0.42" />
            <feFuncG type="linear" slope="0.42" />
            <feFuncB type="linear" slope="0.42" />
            <feFuncA type="linear" slope="0.72" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="restrained-light" mode="screen" result="lit-groove" />
          <feDropShadow
            in="SourceAlpha"
            dx="-3"
            dy="3"
            stdDeviation="3"
            flood-color="#000"
            flood-opacity="0.48"
            result="groove-shadow"
          />
          <feMerge>
            <feMergeNode in="groove-shadow" />
            <feMergeNode in="lit-groove" />
          </feMerge>
        </filter>
        <filter id={id('groove-ambient')} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow
            in="SourceAlpha"
            dx="0"
            dy="1.5"
            stdDeviation="2.4"
            flood-color="#000"
            flood-opacity="0.38"
          />
        </filter>
      </defs>

      {props.layers.substrate ? (
        <image
          class="card-back-artwork__substrate"
          href={source()}
          x="0"
          y="0"
          width="1000"
          height="1400"
          preserveAspectRatio="none"
        />
      ) : null}

      {props.layers.grooves ? (
        <g class="card-back-artwork__grooves">
          <g
            data-groove-lighting={props.layers.keyLight ? 'key' : 'ambient'}
            filter={`url(#${id(props.layers.keyLight ? 'groove-relief' : 'groove-ambient')})`}
            opacity={props.variant === 'ivory' ? '0.62' : '0.78'}
          >
            <CardBackStructuralGeometry
              paint={props.variant === 'ivory' ? '#aaa49b' : '#050607'}
              relief={props.relief}
              widthOffset={props.relief.grooveWidth}
              includePerimeter={false}
              curveRadius={props.relief.curveRadius}
            />
          </g>
        </g>
      ) : null}

      {props.layers.structuralGold ? (
        <image
          class="card-back-artwork__structural-gold"
          href={GOLD_MATERIAL}
          x="0"
          y="0"
          width="1000"
          height="1400"
          preserveAspectRatio="none"
          mask={`url(#${id('structural-gold-mask')})`}
          filter={`url(#${id('gold-relief')})`}
          opacity="0.9"
        />
      ) : null}

      {props.layers.identity ? (
        <image
          class="card-back-artwork__identity"
          href={GOLD_MATERIAL}
          x="0"
          y="0"
          width="1000"
          height="1400"
          preserveAspectRatio="none"
          mask={`url(#${id('identity-mask')})`}
          filter={`url(#${id('gold-relief')})`}
          opacity="0.9"
        />
      ) : null}
    </svg>
  );
};
