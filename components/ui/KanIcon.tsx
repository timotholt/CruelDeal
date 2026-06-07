import { createSignal, onMount, onCleanup, For, Show, mergeProps } from 'solid-js';
import { globalShiftX, globalShiftY, sheenEnabled } from './MotionReflex';

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
  fillMode?: 'gradient' | 'texture'; // Defaults to 'gradient'.
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

  // Local hover tracking
  const [isHovered, setIsHovered] = createSignal(false);
  const [localShiftX, setLocalShiftX] = createSignal(0);
  const [localShiftY, setLocalShiftY] = createSignal(0);

  // Dynamic Shift Offsets (transitions to local coordinates when hovered)
  const activeShiftX = () => {
    if (!props.interactive || !sheenEnabled()) return 0;
    return isHovered() ? localShiftX() : globalShiftX();
  };
  
  const activeShiftY = () => {
    if (!props.interactive || !sheenEnabled()) return 0;
    return isHovered() ? localShiftY() : globalShiftY();
  };

  const isRadialActive = () => {
    return ['R1', 'R2'].includes(props.gradientProfile) || (props.gradientProfile === 'Custom' && props.customType === 'radial');
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
    if (typeof props.size === 'number') {
      return props.size <= 40;
    }
    if (typeof props.size === 'string') {
      const match = props.size.match(/^([\d.]+)(px|rem|em)?$/);
      if (match) {
        const val = parseFloat(match[1]);
        const unit = match[2] || 'px';
        if (unit === 'px') return val <= 40;
        if (unit === 'rem' || unit === 'em') return val <= 2.5;
      }
    }
    return false;
  };

  const getGradientStops = () => {
    if (props.gradientProfile === 'A') {
      return [
        { offset: '0%', color: '#FFF3C2' },
        { offset: '25%', color: '#E2B857' },
        { offset: '50%', color: '#FCF6BA' },
        { offset: '75%', color: '#B28424' },
        { offset: '100%', color: '#FCD267' }
      ];
    }
    if (props.gradientProfile === 'B') {
      return [
        { offset: '0%', color: '#251502' },
        { offset: '25%', color: '#E5B842' },
        { offset: '50%', color: '#FFF7C7' },
        { offset: '75%', color: '#E5B842' },
        { offset: '100%', color: '#251502' }
      ];
    }
    if (props.gradientProfile === 'C') {
      return [
        { offset: '0%', color: '#FFF2C2' },
        { offset: '30%', color: '#C5A44E' },
        { offset: '50%', color: '#A48748' },
        { offset: '70%', color: '#EDCD75' },
        { offset: '100%', color: '#B7984A' }
      ];
    }
    if (props.gradientProfile === 'D') {
      return [
        { offset: '0%', color: '#EBEFF5' },
        { offset: '25%', color: '#B5B9BF' },
        { offset: '50%', color: '#EDF1F7' },
        { offset: '75%', color: '#83878D' },
        { offset: '100%', color: '#CED2D8' }
      ];
    }
    if (props.gradientProfile === 'E') {
      return [
        { offset: '0%', color: '#D1D5DB' },
        { offset: '30%', color: '#6B7280' },
        { offset: '50%', color: '#374151' },
        { offset: '70%', color: '#9CA3AF' },
        { offset: '100%', color: '#4B5563' }
      ];
    }
    if (props.gradientProfile === 'F') {
      return [
        { offset: '0%', color: '#9CA3AF' },
        { offset: '25%', color: '#4B5563' },
        { offset: '50%', color: '#1F2937' },
        { offset: '75%', color: '#111827' },
        { offset: '100%', color: '#374151' }
      ];
    }
    if (props.gradientProfile === 'G') {
      return [
        { offset: '0%', color: '#55411B' },
        { offset: '15%', color: '#997E47' },
        { offset: '30%', color: '#55411B' },
        { offset: '45%', color: '#FFFDDA' },
        { offset: '60%', color: '#D5BB8A' },
        { offset: '75%', color: '#B8A269' },
        { offset: '85%', color: '#55411B' },
        { offset: '100%', color: '#FBECA9' }
      ];
    }
    if (props.gradientProfile === 'I') {
      return [
        { offset: '0%', color: '#7C6535' },
        { offset: '15%', color: '#997E47' },
        { offset: '30%', color: '#7C6535' },
        { offset: '45%', color: '#FFFDDA' },
        { offset: '60%', color: '#D5BB8A' },
        { offset: '75%', color: '#B8A269' },
        { offset: '85%', color: '#7C6535' },
        { offset: '100%', color: '#FBECA9' }
      ];
    }
    if (props.gradientProfile === 'J') {
      return [
        { offset: '0%', color: '#7C6535' },
        { offset: '8%', color: '#997E47' },
        { offset: '26%', color: '#B8A269' },
        { offset: '30%', color: '#7C6535' },
        { offset: '34%', color: '#FFFDDA' },
        { offset: '60%', color: '#D5BB8A' },
        { offset: '81%', color: '#B8A269' },
        { offset: '85%', color: '#7C6535' },
        { offset: '93%', color: '#FBECA9' },
        { offset: '100%', color: '#7C6535' }
      ];
    }
    if (props.gradientProfile === 'K') {
      return [
        { offset: '0%', color: '#FFFDDA' },
        { offset: '31%', color: '#D5BB8A' },
        { offset: '44%', color: '#7C6535' },
        { offset: '100%', color: '#55411B' }
      ];
    }
    if (props.gradientProfile === 'R1') {
      return [
        { offset: '0%', color: '#FFFDDA' },
        { offset: '15%', color: '#D5BB8A' },
        { offset: '35%', color: '#7C6535' },
        { offset: '55%', color: '#FFFDDA' },
        { offset: '75%', color: '#D5BB8A' },
        { offset: '90%', color: '#7C6535' },
        { offset: '100%', color: '#55411B' }
      ];
    }
    if (props.gradientProfile === 'R2') {
      return [
        { offset: '0%', color: '#FFFDDA' },
        { offset: '25%', color: '#D5BB8A' },
        { offset: '60%', color: '#7C6535' },
        { offset: '100%', color: '#55411B' }
      ];
    }
    if (props.gradientProfile === 'Custom') {
      return [...(props.customStops || [])].sort((a, b) => a.offset - b.offset).map(stop => ({
        offset: `${stop.offset}%`,
        color: stop.color
      }));
    }
    return [];
  };

  const finalColorUrl = () => {
    if (props.fillMode === 'texture') {
      return `url(#${uniqueId}-pattern)`;
    }
    if (props.gradientProfile === 'Custom' && props.customType === 'box') {
      return `url(#${uniqueId}-box-pattern)`;
    }
    return isOptical() ? `url(#${uniqueId}-grad-optical)` : `url(#${uniqueId}-grad)`;
  };

  const overlayGradUrl = () => {
    if (props.gradientProfile === 'Custom' && props.customType === 'box') {
      return `url(#${uniqueId}-box-pattern)`;
    }
    return isOptical() ? `url(#${uniqueId}-grad-optical)` : `url(#${uniqueId}-grad-overlay)`;
  };

  // Geometric coordinates for active K line
  const c = () => getKCoords(props.kScale, props.kThickness, props.linecap);

  // Dynamic inline filter glow string
  const glowFilter = () => {
    if (props.glowColor === 'none' || !props.glowColor || props.glowRadius <= 0) {
      return 'none';
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
      onMouseMove={(e) => {
        if (!props.interactive) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        
        // Normalize: moving to the boundary of the coin gets max shift (45px)
        const maxDist = rect.width / 2 || 24; 
        setLocalShiftX(Math.max(-45, Math.min(45, (dx / maxDist) * 45)));
        setLocalShiftY(Math.max(-45, Math.min(45, (dy / maxDist) * 45)));
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <svg 
        viewBox="0 0 100 100" 
        class="w-full h-full" 
        style={{ filter: glowFilter() }}
      >
        <defs>
          {/* Base Material Gradient (Linear or Radial) */}
          <Show when={!isRadialActive() && !(props.gradientProfile === 'Custom' && props.customType === 'box')}>
            <linearGradient 
              id={`${uniqueId}-grad`} 
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
          </Show>
          <Show when={isRadialActive()}>
            <radialGradient
              id={`${uniqueId}-grad`}
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
          </Show>

          {/* Softbox reflection box pattern & blur filter */}
          <Show when={props.gradientProfile === 'Custom' && props.customType === 'box'}>
            <filter id={`${uniqueId}-softbox-blur`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation={props.boxBlur} />
            </filter>
            
            <pattern 
              id={`${uniqueId}-box-pattern`} 
              patternUnits="userSpaceOnUse" 
              width="100" 
              height="100"
            >
              {/* Static Base Metal Gradient */}
              <rect width="100" height="100" fill={`url(#${uniqueId}-box-base-grad)`} />
              
              {/* Sliding Blurred Softbox Rect */}
              <rect 
                x={50 - props.boxWidth / 2 + activeShiftX()} 
                y={50 - props.boxHeight / 2 + activeShiftY()} 
                width={props.boxWidth} 
                height={props.boxHeight} 
                rx={props.boxCornerRadius} 
                ry={props.boxCornerRadius} 
                fill={props.boxColor} 
                opacity={props.boxOpacity}
                filter={`url(#${uniqueId}-softbox-blur)`}
                style={{
                  "mix-blend-mode": props.boxMixBlendMode,
                }}
              />
            </pattern>
            
            <linearGradient 
              id={`${uniqueId}-box-base-grad`}
              x1="0" y1="0" x2="100" y2="100"
              gradientUnits="userSpaceOnUse"
            >
              <For each={getGradientStops()}>
                {(stop) => (
                  <stop offset={stop.offset} stop-color={stop.color} />
                )}
              </For>
            </linearGradient>
          </Show>

          {/* Optional Texture Overlay Gradient Layer */}
          <Show when={!isRadialActive() && !(props.gradientProfile === 'Custom' && props.customType === 'box')}>
            <linearGradient 
              id={`${uniqueId}-grad-overlay`} 
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
          </Show>
          <Show when={isRadialActive()}>
            <radialGradient
              id={`${uniqueId}-grad-overlay`}
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
          </Show>

          {/* Optical Sizing Gradient */}
          <Show when={!isRadialActive() && !(props.gradientProfile === 'Custom' && props.customType === 'box')}>
            <linearGradient
              id={`${uniqueId}-grad-optical`}
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
          </Show>
          <Show when={isRadialActive()}>
            <radialGradient
              id={`${uniqueId}-grad-optical`}
              cx={radialCoords().cx}
              cy={radialCoords().cy}
              r={radialCoords().r}
              fx={radialCoords().fx}
              fy={radialCoords().fy}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stop-color="#FFFDDA" />
              <stop offset="35%" stop-color="#D5BB8A" />
              <stop offset="70%" stop-color="#78581E" />
              <stop offset="100%" stop-color="#4E3D1E" />
            </radialGradient>
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
        <Show when={props.fillMode === 'texture' && props.overlayOpacity > 0}>
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
      </svg>
    </div>
  );
};
