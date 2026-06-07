import { For, Show, mergeProps } from 'solid-js';
import { sheenEnabled } from './reflex/ReflexController';
import { createReflexShift, REFLEX_SVG_UNITS } from './reflex/useReflex';
import { METALS, PROFILE_TO_METAL, metalSvgStops, PRESETS, makeMetalTexture } from './reflex/metals';


export interface KanIconProps {
  size?: number | string; // Width/Height. Defaults to '48px'.
  interactive?: boolean; // Enable mouse/gyroscope parallax sheen. Defaults to true.
  glowColor?: string; // Glow color (default: rgba(251, 191, 36, 0.45)). Set to 'none' to disable.
  glowRadius?: number; // Size of drop shadow glow blur. Defaults to 8.
  rings?: number; // Concentric border rings (1, 2, or 3). Defaults to 3.
  ringGap?: number; // Gap spacing between rings. Defaults to 6.5.
  thickness?: number; // Border thickness. Defaults to 3.5.
  kThickness?: number; // K letter thickness. Defaults to 6.5.
  kScale?: number; // K size scale. Defaults to 0.8.
  linecap?: 'butt' | 'round'; // Cap style for K lines. Defaults to 'butt'.
  bevelOffset?: number; // 3D bevel size. Defaults to 0.6.
  bevelOpacity?: number; // 3D bevel highlight opacity. Defaults to 0.6.
  hexFillOpacity?: number; // Inner hexagon face transparency. Defaults to 0.12.
  kBlockMode?: boolean; // Set to true to render K as a solid block. Defaults to false.
  
  // Custom alignment adjustments
  kOffsetX?: number; // Offset X nudge. Defaults to -0.5.
  kOffsetY?: number; // Offset Y nudge. Defaults to 0.
  kDiag2X?: number; // Lower arm diagonal connection. Defaults to -1.
  kDiag1Slope?: number; // Upper arm slant angle. Defaults to 0.86.
  kDiag2Slope?: number; // Lower arm slant angle. Defaults to 0.60.
  kDiagWidth?: number; // Arm span width. Defaults to 25.5.
  
  // Material schemes
  gradientProfile?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'I' | 'J' | 'K' | 'R1' | 'R2' | 'Custom'; // Pre-packaged metal gradient profile. Defaults to 'J'.
  customStops?: Array<{ offset: number; color: string }>; // Custom stops (for 'Custom' profile).
  gradientAngle?: number; // Angle of the gradient. Defaults to 45.
  gradientScale?: number; // Scaling/width of gradient transitions. Defaults to 1.0.
  gradientShift?: number; // Static shift offset. Defaults to 0.
  
  // Softbox settings
  boxWidth?: number;
  boxHeight?: number;
  boxBlur?: number;
  boxColor?: string;
  boxOpacity?: number;
  boxCornerRadius?: number;
  boxMixBlendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'color-dodge' | 'soft-light';

  // Texture schemes
  fillMode?: 'gradient' | 'texture' | 'procedural'; // Defaults to 'gradient'.
  selectedTexture?: string; // Name of active image file (default: Gold01.png)
  textureScale?: number; // Scale/zoom of texture image. Defaults to 1.0.
  textureOffsetX?: number; // Texture X offset. Defaults to 0.
  textureOffsetY?: number; // Texture Y offset. Defaults to 0.
  textureBrightness?: number;
  textureContrast?: number;
  textureSaturation?: number;
  overlayOpacity?: number;
  overlayBlendMode?: 'overlay' | 'color-dodge' | 'multiply' | 'screen' | 'soft-light';
  customType?: 'linear' | 'radial' | 'box';

  // Custom class for outer wrapper
  class?: string;
  // Unique ID prefix to prevent SVG defs collision when rendering multiple instances on the same page
  idPrefix?: string;
}

export const KanIcon = (rawProps: KanIconProps) => {
  // Merge default values
  const props = mergeProps({
    size: '48px',
    interactive: true,
    glowColor: 'rgba(251, 191, 36, 0.45)',
    glowRadius: 8,
    rings: 3,
    ringGap: 6.5,
    thickness: 3.5,
    kThickness: 6.5,
    kScale: 0.8,
    linecap: 'butt' as const,
    bevelOffset: 0.6,
    bevelOpacity: 0.6,
    hexFillOpacity: 0.12,
    kBlockMode: false,
    kOffsetX: -0.5,
    kOffsetY: 0,
    kDiag2X: -1,
    kDiag1Slope: 0.86,
    kDiag2Slope: 0.60,
    kDiagWidth: 25.5,
    gradientProfile: 'J' as const,
    gradientAngle: 45,
    gradientScale: 1.0,
    gradientShift: 0,
    boxWidth: 45,
    boxHeight: 45,
    boxBlur: 12,
    boxColor: '#FFFDDA',
    boxOpacity: 0.6,
    boxCornerRadius: 10,
    boxMixBlendMode: 'color-dodge' as const,
    fillMode: 'gradient' as const,
    selectedTexture: 'Gold01.png',
    textureScale: 1.0,
    textureOffsetX: 0,
    textureOffsetY: 0,
    textureBrightness: 1.0,
    textureContrast: 1.0,
    textureSaturation: 1.0,
    overlayOpacity: 0.4,
    overlayBlendMode: 'overlay' as const,
    customType: 'linear' as const,
    class: '',
  }, rawProps);

  // Generate unique ID prefix to isolate gradients
  const uniqueId = props.idPrefix || `kan-${Math.random().toString(36).substring(2, 9)}`;

  // Single unified reflex source — global tilt/pointer direction shared by every
  // surface. No listeners, no rect reads, no hover/global swap, no per-mode
  // damping: every mode and every icon reads the same nx/ny and moves 24/7.
  const reflex = createReflexShift();

  const activeShiftX = () => {
    if (!props.interactive || !sheenEnabled()) return 0;
    return reflex().nx * REFLEX_SVG_UNITS;
  };

  const activeShiftY = () => {
    if (!props.interactive || !sheenEnabled()) return 0;
    return reflex().ny * REFLEX_SVG_UNITS;
  };

  const isRadialActive = () => {
    return props.customType === 'radial' || ['R1', 'R2'].includes(props.gradientProfile);
  };

  // Geometry math helpers
  const getHexagonPoints = (index: number, borderStroke: number) => {
    const baseRadius = 45;
    const H_0 = baseRadius * 0.866025; // Height of base hexagon
    const H_i = H_0 - index * props.ringGap;
    const R_i = H_i / 0.866025; // Adjusted radius
    const h = H_i;
    
    return `${(50 - R_i/2).toFixed(2)}, ${(50 - h).toFixed(2)} ${(50 + R_i/2).toFixed(2)}, ${(50 - h).toFixed(2)} ${(50 + R_i).toFixed(2)}, 50 ${(50 + R_i/2).toFixed(2)}, ${(50 + h).toFixed(2)} ${(50 - R_i/2).toFixed(2)}, ${(50 + h).toFixed(2)} ${(50 - R_i).toFixed(2)}, 50`;
  };

  const getKCoords = (S: number, kThick: number, capStyle: 'butt' | 'round') => {
    const startX = 50 - 12 * S + props.kOffsetX;
    const y1 = 50 - 22 * S + props.kOffsetY;
    const y2 = 50 + 22 * S + props.kOffsetY;
    const offset = capStyle === 'round' ? kThick / 2 : 0;
    
    const y_anchor1 = y1 - offset;
    const y_anchor2 = y2 + offset;
    const x_anchor1 = startX + props.kDiagWidth * S;
    const x_anchor2 = startX + props.kDiagWidth * S;

    const diag1Y1Val = y_anchor1 + (x_anchor1 - startX) / props.kDiag1Slope;
    const diag1X1Val = startX;

    const diag2X1Val = 50 + props.kDiag2X * S + props.kOffsetX;
    const diag2Y1Val = y_anchor2 - (x_anchor2 - diag2X1Val) / props.kDiag2Slope;

    const ext = kThick * 1.5 + 4;
    const diag1Y2Val = y_anchor1 - ext;
    const diag1X2Val = x_anchor1 + ext * props.kDiag1Slope;
    
    const diag2Y2Val = y_anchor2 + ext;
    const diag2X2Val = x_anchor2 + ext * props.kDiag2Slope;
    
    return {
      stemX1: startX.toFixed(2),
      stemX2: (startX + 0.01).toFixed(2),
      stemY1: y1.toFixed(2),
      stemY2: y2.toFixed(2),
      diag1X1: diag1X1Val.toFixed(2),
      diag1Y1: diag1Y1Val.toFixed(2),
      diag1X2: diag1X2Val.toFixed(2),
      diag1Y2: diag1Y2Val.toFixed(2),
      diag2X1: diag2X1Val.toFixed(2),
      diag2Y1: diag2Y1Val.toFixed(2),
      diag2X2: diag2X2Val.toFixed(2),
      diag2Y2: diag2Y2Val.toFixed(2),
      clipY: (y1 - offset).toFixed(2),
      clipHeight: ((y2 - y1) + offset * 2).toFixed(2),
    };
  };

  // Gradient Coordinate Calculations
  const gradCoords = () => {
    const rad = (props.gradientAngle * Math.PI) / 180;
    const cx = 50;
    const cy = 50;
    const r = 50 * Math.sqrt(2) * props.gradientScale;
    
    const baseX1 = cx - r * Math.cos(rad);
    const baseY1 = cy - r * Math.sin(rad);
    const baseX2 = cx + r * Math.cos(rad);
    const baseY2 = cy + r * Math.sin(rad);
    
    const shiftX = props.gradientShift * Math.cos(rad);
    const shiftY = props.gradientShift * Math.sin(rad);
    
    return {
      x1: baseX1 + shiftX + activeShiftX(),
      y1: baseY1 + shiftY + activeShiftY(),
      x2: baseX2 + shiftX + activeShiftX(),
      y2: baseY2 + shiftY + activeShiftY()
    };
  };

  const radialCoords = () => {
    const rad = (props.gradientAngle * Math.PI) / 180;
    const r = 50 * props.gradientScale;
    const fx = 50 + activeShiftX() + (props.gradientShift * Math.cos(rad));
    const fy = 50 + activeShiftY() + (props.gradientShift * Math.sin(rad));
    return { cx: 50, cy: 50, r, fx, fy };
  };

  const isOptical = () => {
    return false;
  };
  
  const getCanonicalMetal = () => {
    const profile = props.gradientProfile;
    if (['D', 'E', 'silver'].includes(profile)) return 'silver';
    if (['G', 'brass'].includes(profile)) return 'brass';
    if (['F', 'mark'].includes(profile)) return 'mark';
    if (['credit'].includes(profile)) return 'credit';
    return 'gold';
  };

  const getGradientStops = () => {
    // Canonical metals (gold=J, silver=D, brass=G, mark=F) come from the single
    // shared registry so the hex matches the text/buttons exactly.
    const metal = PROFILE_TO_METAL[props.gradientProfile];
    if (metal) return metalSvgStops(METALS[metal]);
    
    if (props.gradientProfile === 'Custom') {
      return [...(props.customStops || [])].sort((a, b) => a.offset - b.offset).map(stop => ({
        offset: `${stop.offset}%`,
        color: stop.color
      }));
    }
    
    const stops = PRESETS[props.gradientProfile] || PRESETS.J;
    return stops.map(s => ({ offset: `${s.offset}%`, color: s.color }));
  };

  const finalColorUrl = () => {
    if (props.fillMode === 'texture') {
      return `url(#${uniqueId}-pattern)`;
    }
    if (props.fillMode === 'procedural') {
      return `url(#${uniqueId}-procedural-pattern)`;
    }
    if (props.customType === 'box') {
      return `url(#${uniqueId}-grad-base)`;
    }
    if (isOptical()) {
      return isRadialActive() ? `url(#${uniqueId}-grad-optical-radial)` : `url(#${uniqueId}-grad-optical-linear)`;
    }
    return isRadialActive() ? `url(#${uniqueId}-grad-radial)` : `url(#${uniqueId}-grad-linear)`;
  };

  const overlayGradUrl = () => {
    if (props.customType === 'box') {
      return `url(#${uniqueId}-box-pattern)`;
    }
    if (isOptical()) {
      return isRadialActive() ? `url(#${uniqueId}-grad-optical-radial)` : `url(#${uniqueId}-grad-optical-linear)`;
    }
    return isRadialActive() ? `url(#${uniqueId}-grad-radial)` : `url(#${uniqueId}-grad-linear)`;
  };

  // Geometric coordinates for active K line
  const c = () => getKCoords(props.kScale, props.kThickness, props.linecap);

  // Dynamic inline filter glow string. Returns undefined when off so no filter
  // CSS is emitted at all (no `filter: none` no-op).
  const glowFilter = () => {
    if (props.glowColor === 'none' || !props.glowColor || props.glowRadius <= 0) {
      return undefined;
    }
    return `drop-shadow(0 0 ${props.glowRadius}px ${props.glowColor})`;
  };

  return (
    <div
      class={`relative flex items-center justify-center ${props.class}`}
      style={{
        width: typeof props.size === 'number' ? `${props.size}px` : props.size,
        height: typeof props.size === 'number' ? `${props.size}px` : props.size,
      }}
    >
      <svg 
        viewBox="0 0 100 100" 
        class="w-full h-full" 
        style={{ filter: glowFilter() }}
      >
        <defs>
          {/* Base metal gradient for softbox mode (clean background without linear shiny bands) */}
          <linearGradient id={`${uniqueId}-grad-base`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Show when={['gold', 'kan', 'Custom', 'J', 'K', 'A', 'B', 'C', 'G', 'I', 'R1', 'R2'].includes(props.gradientProfile)}>
              <stop offset="0%" stop-color="#7C6535" />
              <stop offset="50%" stop-color="#D5BB8A" />
              <stop offset="100%" stop-color="#7C6535" />
            </Show>
            <Show when={['silver', 'D', 'E'].includes(props.gradientProfile)}>
              <stop offset="0%" stop-color="#70757D" />
              <stop offset="50%" stop-color="#CED2D8" />
              <stop offset="100%" stop-color="#5B5F66" />
            </Show>
            <Show when={['brass'].includes(props.gradientProfile)}>
              <stop offset="0%" stop-color="#55411B" />
              <stop offset="50%" stop-color="#B8A269" />
              <stop offset="100%" stop-color="#55411B" />
            </Show>
            <Show when={['mark', 'F'].includes(props.gradientProfile)}>
              <stop offset="0%" stop-color="#4b5563" />
              <stop offset="50%" stop-color="#9ca3af" />
              <stop offset="100%" stop-color="#374151" />
            </Show>
          </linearGradient>

          {/* Base Linear Gradient */}
          <linearGradient 
            id={`${uniqueId}-grad-linear`} 
            x1={gradCoords().x1} 
            y1={gradCoords().y1} 
            x2={gradCoords().x2} 
            y2={gradCoords().y2} 
            gradientUnits="userSpaceOnUse"
            spreadMethod="reflect"
          >
            <For each={getGradientStops()}>
              {(stop) => (
                <stop offset={stop.offset} stop-color={stop.color} />
              )}
            </For>
          </linearGradient>

          {/* Base Radial Gradient */}
          <radialGradient
            id={`${uniqueId}-grad-radial`}
            cx={radialCoords().cx}
            cy={radialCoords().cy}
            r={radialCoords().r}
            fx={radialCoords().fx}
            fy={radialCoords().fy}
            gradientUnits="userSpaceOnUse"
          >
            <For each={getGradientStops()}>
              {(stop) => (
                <stop offset={stop.offset} stop-color={stop.color} />
              )}
            </For>
          </radialGradient>

          {/* Softbox reflection box pattern & blur filter */}
          <Show when={props.customType === 'box'}>
            <filter id={`${uniqueId}-softbox-blur`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation={props.boxBlur} />
            </filter>
            
            <pattern 
              id={`${uniqueId}-box-pattern`} 
              patternUnits="userSpaceOnUse" 
              x={activeShiftX()}
              y={activeShiftY()}
              width="100" 
              height="100"
            >
              {/* Static Blurred Softbox Rect */}
              <rect 
                x={50 - props.boxWidth / 2} 
                y={50 - props.boxHeight / 2} 
                width={props.boxWidth} 
                height={props.boxHeight} 
                rx={props.boxCornerRadius} 
                ry={props.boxCornerRadius} 
                fill={props.boxColor} 
                opacity={props.boxOpacity}
                filter={`url(#${uniqueId}-softbox-blur)`}
              />
            </pattern>
          </Show>

          {/* Optical Sizing Linear Gradient */}
          <linearGradient
            id={`${uniqueId}-grad-optical-linear`}
            x1={gradCoords().x1}
            y1={gradCoords().y1}
            x2={gradCoords().x2}
            y2={gradCoords().y2}
            gradientUnits="userSpaceOnUse"
            spreadMethod="reflect"
          >
            <Show when={['A', 'B', 'C', 'G', 'I', 'J', 'K', 'Custom'].includes(props.gradientProfile)}>
              <stop offset="0%" stop-color="#78581E" />
              <stop offset="30%" stop-color="#E2B857" />
              <stop offset="55%" stop-color="#FFF3C2" />
              <stop offset="80%" stop-color="#E2B857" />
              <stop offset="100%" stop-color="#9E782F" />
            </Show>
            <Show when={['D', 'E', 'F'].includes(props.gradientProfile)}>
              <stop offset="0%" stop-color="#70757D" />
              <stop offset="30%" stop-color="#CED2D8" />
              <stop offset="55%" stop-color="#EBEFF5" />
              <stop offset="80%" stop-color="#CED2D8" />
              <stop offset="100%" stop-color="#5B5F66" />
            </Show>
          </linearGradient>

          {/* Optical Sizing Radial Gradient */}
          <radialGradient
            id={`${uniqueId}-grad-optical-radial`}
            cx={radialCoords().cx}
            cy={radialCoords().cy}
            r={radialCoords().r}
            fx={radialCoords().fx}
            fy={radialCoords().fy}
            gradientUnits="userSpaceOnUse"
          >
            <Show when={['A', 'B', 'C', 'G', 'I', 'J', 'K', 'Custom'].includes(props.gradientProfile)}>
              <stop offset="0%" stop-color="#FFFDDA" />
              <stop offset="35%" stop-color="#D5BB8A" />
              <stop offset="70%" stop-color="#78581E" />
              <stop offset="100%" stop-color="#4E3D1E" />
            </Show>
            <Show when={['D', 'E', 'F'].includes(props.gradientProfile)}>
              <stop offset="0%" stop-color="#EBEFF5" />
              <stop offset="35%" stop-color="#CED2D8" />
              <stop offset="70%" stop-color="#70757D" />
              <stop offset="100%" stop-color="#3A3D42" />
            </Show>
          </radialGradient>

          {/* Baked Canvas Metal — the "canvas metal" method. ONE pre-baked
              texture (same METALS stops + grain) revealed through the hex+K
              shape, slid by the reflex direction. Pattern is 2x the viewBox and
              centred so the reflex offset never reaches a tile seam. */}
          <Show when={props.fillMode === 'procedural'}>
            <pattern
              id={`${uniqueId}-procedural-pattern`}
              patternUnits="userSpaceOnUse"
              x={-50 + (props.interactive ? activeShiftX() : 0)}
              y={-50 + (props.interactive ? activeShiftY() : 0)}
              width={200}
              height={200}
            >
              <image
                href={makeMetalTexture(getCanonicalMetal())}
                width={200}
                height={200}
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          </Show>

          {/* Photographic Texture Image Pattern */}
          <pattern 
            id={`${uniqueId}-pattern`} 
            patternUnits="userSpaceOnUse" 
            x={props.textureOffsetX + activeShiftX()} 
            y={props.textureOffsetY + activeShiftY()} 
            width={100 * props.textureScale} 
            height={100 * props.textureScale}
          >
            <image 
              href={`/gold-textures/${props.selectedTexture}`} 
              x="0" 
              y="0" 
              width={100 * props.textureScale} 
              height={100 * props.textureScale} 
              preserveAspectRatio="xMidYMid slice" 
              style={{
                filter: `brightness(${props.textureBrightness}) contrast(${props.textureContrast}) saturate(${props.textureSaturation})`
              }} 
            />
          </pattern>

          {/* Horizontal clip path to crop diagonals flat */}
          <clipPath id={`${uniqueId}-clip`}>
            <rect x="10" y={c().clipY} width="80" height={c().clipHeight} />
          </clipPath>
        </defs>

        {/* 1. Hexagon Shadow Pass */}
        <For each={Array.from({ length: props.rings }, (_, i) => i)}>
          {(index) => (
            <polygon 
              points={getHexagonPoints(index, props.thickness)} 
              fill={index === 0 ? finalColorUrl() : 'none'} 
              fill-opacity={index === 0 ? props.hexFillOpacity : 0}
              stroke="#201A0A" 
              stroke-width={props.thickness + props.bevelOffset * 1.5}
              stroke-linejoin={props.linecap === 'round' ? 'round' : 'miter'}
              transform={`translate(${props.bevelOffset}, ${props.bevelOffset})`}
            />
          )}
        </For>

        {/* 2. Hexagon Highlight Pass */}
        <For each={Array.from({ length: props.rings }, (_, i) => i)}>
          {(index) => (
            <polygon 
              points={getHexagonPoints(index, props.thickness)} 
              fill="none" 
              stroke="#FFFDDA" 
              stroke-width={props.thickness + props.bevelOffset * 0.5}
              stroke-linejoin={props.linecap === 'round' ? 'round' : 'miter'}
              transform={`translate(${-props.bevelOffset}, ${-props.bevelOffset})`}
              opacity={props.bevelOpacity}
            />
          )}
        </For>

        {/* 3. Hexagon Main Pass */}
        <For each={Array.from({ length: props.rings }, (_, i) => i)}>
          {(index) => (
            <polygon 
              points={getHexagonPoints(index, props.thickness)} 
              fill={index === 0 ? finalColorUrl() : 'none'} 
              fill-opacity={index === 0 ? props.hexFillOpacity : 0}
              stroke={finalColorUrl()} 
              stroke-width={props.thickness}
              stroke-linejoin={props.linecap === 'round' ? 'round' : 'miter'}
            />
          )}
        </For>

        {/* 4. Optional Hexagon Texture Specular Overlay Pass */}
        <Show when={props.fillMode === 'texture' && props.overlayOpacity > 0}>
          <For each={Array.from({ length: props.rings }, (_, i) => i)}>
            {(index) => (
              <polygon 
                points={getHexagonPoints(index, props.thickness)} 
                fill={index === 0 ? overlayGradUrl() : 'none'} 
                fill-opacity={index === 0 ? props.hexFillOpacity : 0}
                stroke={overlayGradUrl()} 
                stroke-width={props.thickness}
                stroke-linejoin={props.linecap === 'round' ? 'round' : 'miter'}
                style={{
                  "mix-blend-mode": props.overlayBlendMode,
                  opacity: props.overlayOpacity,
                  "pointer-events": "none"
                }}
              />
            )}
          </For>
        </Show>

        {/* 4.5. Optional Softbox Specular Overlay Pass for Gradient Mode */}
        <Show when={(props.fillMode === 'gradient' || props.fillMode === 'procedural') && props.customType === 'box'}>
          <For each={Array.from({ length: props.rings }, (_, i) => i)}>
            {(index) => (
              <polygon 
                points={getHexagonPoints(index, props.thickness)} 
                fill={index === 0 ? `url(#${uniqueId}-box-pattern)` : 'none'} 
                fill-opacity={index === 0 ? props.hexFillOpacity : 0}
                stroke={`url(#${uniqueId}-box-pattern)`} 
                stroke-width={props.thickness}
                stroke-linejoin={props.linecap === 'round' ? 'round' : 'miter'}
                style={{
                  "mix-blend-mode": props.boxMixBlendMode,
                  "pointer-events": "none"
                }}
              />
            )}
          </For>
        </Show>

        {/* 5. K Shadows Pass */}
        <path 
          d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
          fill="none"
          stroke="#201A0A"
          stroke-width={props.kThickness + props.bevelOffset * 1.5}
          stroke-linecap={props.linecap}
          transform={`translate(${props.bevelOffset}, ${props.bevelOffset})`}
        />
        <g clip-path={`url(#${uniqueId}-clip)`}>
          <path 
            d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
            fill="none"
            stroke="#201A0A"
            stroke-width={props.kThickness + props.bevelOffset * 1.5}
            stroke-linecap={props.linecap}
            stroke-linejoin="miter"
            transform={`translate(${props.bevelOffset}, ${props.bevelOffset})`}
          />
          <path 
            d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
            fill="none"
            stroke="#201A0A"
            stroke-width={props.kThickness + props.bevelOffset * 1.5}
            stroke-linecap={props.linecap}
            stroke-linejoin="miter"
            transform={`translate(${props.bevelOffset}, ${props.bevelOffset})`}
          />
        </g>

        {/* 6. K Highlights Pass */}
        <path 
          d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
          fill="none"
          stroke="#FFFDDA"
          stroke-width={props.kThickness + props.bevelOffset * 0.5}
          stroke-linecap={props.linecap}
          transform={`translate(${-props.bevelOffset}, ${-props.bevelOffset})`}
          opacity={props.bevelOpacity}
        />
        <g clip-path={`url(#${uniqueId}-clip)`}>
          <path 
            d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
            fill="none"
            stroke="#FFFDDA"
            stroke-width={props.kThickness + props.bevelOffset * 0.5}
            stroke-linecap={props.linecap}
            stroke-linejoin="miter"
            transform={`translate(${-props.bevelOffset}, ${-props.bevelOffset})`}
            opacity={props.bevelOpacity}
          />
          <path 
            d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
            fill="none"
            stroke="#FFFDDA"
            stroke-width={props.kThickness + props.bevelOffset * 0.5}
            stroke-linecap={props.linecap}
            stroke-linejoin="miter"
            transform={`translate(${-props.bevelOffset}, ${-props.bevelOffset})`}
            opacity={props.bevelOpacity}
          />
        </g>

        {/* 7. K Main Pass */}
        <path 
          d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
          fill="none"
          stroke={finalColorUrl()}
          stroke-width={props.kThickness}
          stroke-linecap={props.linecap}
        />
        <g clip-path={`url(#${uniqueId}-clip)`}>
          <path 
            d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
            fill="none"
            stroke={finalColorUrl()}
            stroke-width={props.kThickness}
            stroke-linecap={props.linecap}
            stroke-linejoin="miter"
          />
          <path 
            d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
            fill="none"
            stroke={finalColorUrl()}
            stroke-width={props.kThickness}
            stroke-linecap={props.linecap}
            stroke-linejoin="miter"
          />
        </g>

        {/* 8. K Texture spec overlay Pass */}
        <Show when={(props.fillMode === 'texture' || props.fillMode === 'procedural') && props.overlayOpacity > 0}>
          <path 
            d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
            fill="none"
            stroke={overlayGradUrl()}
            stroke-width={props.kThickness}
            stroke-linecap={props.linecap}
            style={{
              "mix-blend-mode": props.overlayBlendMode,
              opacity: props.overlayOpacity,
              "pointer-events": "none"
            }}
          />
          <g clip-path={`url(#${uniqueId}-clip)`}>
            <path 
              d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
              fill="none"
              stroke={overlayGradUrl()}
              stroke-width={props.kThickness}
              stroke-linecap={props.linecap}
              stroke-linejoin="miter"
              style={{
                "mix-blend-mode": props.overlayBlendMode,
                opacity: props.overlayOpacity,
                "pointer-events": "none"
              }}
            />
            <path 
              d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
              fill="none"
              stroke={overlayGradUrl()}
              stroke-width={props.kThickness}
              stroke-linecap={props.linecap}
              stroke-linejoin="miter"
              style={{
                "mix-blend-mode": props.overlayBlendMode,
                opacity: props.overlayOpacity,
                "pointer-events": "none"
              }}
            />
          </g>
        </Show>

        {/* 8.5. K Softbox specular overlay Pass for Gradient Mode */}
        <Show when={(props.fillMode === 'gradient' || props.fillMode === 'procedural') && props.customType === 'box'}>
          <path 
            d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
            fill="none"
            stroke={`url(#${uniqueId}-box-pattern)`}
            stroke-width={props.kThickness}
            stroke-linecap={props.linecap}
            style={{
              "mix-blend-mode": props.boxMixBlendMode,
              "pointer-events": "none"
            }}
          />
          <g clip-path={`url(#${uniqueId}-clip)`}>
            <path 
              d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
              fill="none"
              stroke={`url(#${uniqueId}-box-pattern)`}
              stroke-width={props.kThickness}
              stroke-linecap={props.linecap}
              stroke-linejoin="miter"
              style={{
                "mix-blend-mode": props.boxMixBlendMode,
                "pointer-events": "none"
              }}
            />
            <path 
              d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
              fill="none"
              stroke={`url(#${uniqueId}-box-pattern)`}
              stroke-width={props.kThickness}
              stroke-linecap={props.linecap}
              stroke-linejoin="miter"
              style={{
                "mix-blend-mode": props.boxMixBlendMode,
                "pointer-events": "none"
              }}
            />
          </g>
        </Show>
      </svg>
    </div>
  );
};
