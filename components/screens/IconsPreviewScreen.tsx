import { createSignal, For, Show, createEffect } from 'solid-js';
import { KanIcon } from '../ui/KanIcon';
import { createReflexShift, REFLEX_SVG_UNITS } from '../ui/reflex/useReflex';
import { 
  ReflectiveText, 
  EmbossedReflectiveText, 
  ReflectiveProgressBar, 
  ReflectiveButton, 
  sheenEnabled, 
  setSheenEnabled,
  enableMobileGyroscope,
  gyroActive
} from '../ui/MotionReflex';
import { MaterialRichText } from '../ui/material-node/MaterialRichText';

// Color Conversion Helpers
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = hex.trim().replace(/^#/, '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  if (c.length !== 6) {
    return { r: 213, g: 187, b: 138 }; // Default neutral gold (#D5BB8A)
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const hex = ((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, '0');
  return `#${hex}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;
  let r = l;
  let g = l;
  let b = l;

  if (s !== 0) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex);
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

interface SoftboxPreset {
  name: string;
  width: number;
  height: number;
  blur: number;
  cornerRadius: number;
  opacity: number;
  color: string;
  mixBlendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'color-dodge' | 'soft-light';
}

const SOFTBOX_PRESETS: Record<string, SoftboxPreset> = {
  classic: {
    name: 'Classic Softbox',
    width: 45,
    height: 45,
    blur: 12,
    cornerRadius: 10,
    opacity: 0.60,
    color: '#FFFDDA',
    mixBlendMode: 'color-dodge'
  },
  vertical: {
    name: 'Vertical Stripbox',
    width: 15,
    height: 70,
    blur: 8,
    cornerRadius: 4,
    opacity: 0.75,
    color: '#FFFFFF',
    mixBlendMode: 'color-dodge'
  },
  horizontal: {
    name: 'Horizontal Skylight',
    width: 80,
    height: 20,
    blur: 10,
    cornerRadius: 6,
    opacity: 0.65,
    color: '#FFEFAA',
    mixBlendMode: 'overlay'
  },
  ring: {
    name: 'Overhead Ring Light',
    width: 65,
    height: 65,
    blur: 16,
    cornerRadius: 32,
    opacity: 0.50,
    color: '#FFFFFF',
    mixBlendMode: 'screen'
  },
  diffuse: {
    name: 'Diffuse Panel',
    width: 85,
    height: 85,
    blur: 24,
    cornerRadius: 15,
    opacity: 0.40,
    color: '#FFF3C2',
    mixBlendMode: 'color-dodge'
  },
  spot: {
    name: 'Spot Highlight',
    width: 20,
    height: 20,
    blur: 4,
    cornerRadius: 10,
    opacity: 0.85,
    color: '#FFFFFF',
    mixBlendMode: 'color-dodge'
  }
};

export const IconsPreviewScreen = () => {
  // Signals for interactive SVG controls
  const interactiveSheen = sheenEnabled;
  const setInteractiveSheen = setSheenEnabled;
  const [gyroEnabled, setGyroEnabled] = createSignal(false);
  const [hasGyroPermission, setHasGyroPermission] = createSignal(false);

  // Gate for performance-heavy effects (blur / glow / texture filters) that lag
  // on phones. Off by default; turning it off also forces those effects inactive
  // so nothing heavy is emitted.
  const [heavyFx, setHeavyFx] = createSignal(false);
  const toggleHeavyFx = (on: boolean) => {
    setHeavyFx(on);
    if (!on) {
      if (customType() === 'box') setCustomType('linear');
      if (fillMode() === 'texture') setFillMode('gradient');
      setGlowIntensity(0);
    }
  };

  // Softbox signals
  const [boxWidth, setBoxWidth] = createSignal(45);
  const [boxHeight, setBoxHeight] = createSignal(45);
  const [boxBlur, setBoxBlur] = createSignal(12);
  const [boxColor, setBoxColor] = createSignal('#FFFDDA');
  const [boxOpacity, setBoxOpacity] = createSignal(0.6);
  const [boxCornerRadius, setBoxCornerRadius] = createSignal(10);
  const [boxMixBlendMode, setBoxMixBlendMode] = createSignal<'normal' | 'multiply' | 'screen' | 'overlay' | 'color-dodge' | 'soft-light'>('color-dodge');
  const [demoProgress, setDemoProgress] = createSignal(65);
  const [customInputText, setCustomInputText] = createSignal("You earned [gold]50 Gold[/gold], [silver]10 Silver[/silver], and [mark]3 Marks[/mark]!");

  const [thickness, setThickness] = createSignal(3.5);
  const [kThickness, setKThickness] = createSignal(6.5);
  const [hexFillOpacity, setHexFillOpacity] = createSignal(0.12);
  const [glowIntensity, setGlowIntensity] = createSignal(0);
  const [linecap, setLinecap] = createSignal<'butt' | 'round'>('butt');
  const [rings, setRings] = createSignal<1 | 2 | 3>(3);
  const [ringGap, setRingGap] = createSignal(6.5);
  const [kScale, setKScale] = createSignal(0.8);
  const [gradientProfile, setGradientProfile] = createSignal<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'I' | 'J' | 'K' | 'R1' | 'R2' | 'Custom'>('J');
  const [kDiag2X, setKDiag2X] = createSignal(-1);
  const [kDiag1Slope, setKDiag1Slope] = createSignal(0.86);
  const [kDiag2Slope, setKDiag2Slope] = createSignal(0.60);
  const [kDiagWidth, setKDiagWidth] = createSignal(25.5);
  const [kOffsetX, setKOffsetX] = createSignal(-0.5);
  const [kOffsetY, setKOffsetY] = createSignal(0);
  const [fillMode, setFillMode] = createSignal<'gradient' | 'texture'>('gradient');
  const [selectedTexture, setSelectedTexture] = createSignal('Gold01.png');
  const [textureScale, setTextureScale] = createSignal(1.0);
  const [textureOffsetX, setTextureOffsetX] = createSignal(0);
  const [textureOffsetY, setTextureOffsetY] = createSignal(0);
  const [textureBrightness, setTextureBrightness] = createSignal(1.0);
  const [textureContrast, setTextureContrast] = createSignal(1.0);
  const [textureSaturation, setTextureSaturation] = createSignal(1.0);
  const [overlayOpacity, setOverlayOpacity] = createSignal(0.4);
  const [overlayBlendMode, setOverlayBlendMode] = createSignal<'overlay' | 'color-dodge' | 'multiply' | 'screen' | 'soft-light'>('overlay');
  const [bevelOffset, setBevelOffset] = createSignal(0.6);
  const [bevelOpacity, setBevelOpacity] = createSignal(0.6);
  const [kBlockMode, setKBlockMode] = createSignal(false);

  // Single unified reflex source — global tilt/pointer direction, shared by the
  // inline SVG preview math exactly like KanIcon.
  const previewReflex = createReflexShift();
  const interactiveShiftX = () => previewReflex().nx * REFLEX_SVG_UNITS;
  const interactiveShiftY = () => previewReflex().ny * REFLEX_SVG_UNITS;

  const requestGyroPermission = async () => {
    const ok = await enableMobileGyroscope();
    if (ok) {
      setHasGyroPermission(true);
      setGyroEnabled(true);
    } else {
      alert('Gyroscope tilt permission was denied.');
    }
  };

  // Interactive Gradient Stop Editor State
  const [gradientAngle, setGradientAngle] = createSignal<number>(45);
  const [gradientScale, setGradientScale] = createSignal<number>(1.0);
  const [gradientShift, setGradientShift] = createSignal<number>(0);
  const [customType, setCustomType] = createSignal<'linear' | 'radial' | 'box'>('linear');
  const [hoveredStopId, setHoveredStopId] = createSignal<number | null>(null);
  const [activeColorPickerStopId, setActiveColorPickerStopId] = createSignal<number | null>(null);
  const [colorMode, setColorMode] = createSignal<'HEX' | 'HSL' | 'RGB'>('HSL');
  
  // Custom picker local states
  const [pickerH, setPickerH] = createSignal(0);
  const [pickerS, setPickerS] = createSignal(0);
  const [pickerL, setPickerL] = createSignal(0);
  const [pickerR, setPickerR] = createSignal(0);
  const [pickerG, setPickerG] = createSignal(0);
  const [pickerB, setPickerB] = createSignal(0);
  const [pickerHex, setPickerHex] = createSignal('');
  const [colorCopiedFeedback, setColorCopiedFeedback] = createSignal(false);

  const copyColor = async () => {
    const hex = pickerHex();
    try {
      await navigator.clipboard.writeText(hex);
      setColorCopiedFeedback(true);
      setTimeout(() => setColorCopiedFeedback(false), 1500);
    } catch (err) {
      alert(`Clipboard write failed. Here is the color code: ${hex}`);
    }
  };

  const pasteColor = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        let cleanHex = text.trim();
        if (!cleanHex.startsWith('#')) {
          cleanHex = '#' + cleanHex;
        }
        if (cleanHex.match(/^#[0-9A-Fa-f]{6}$/)) {
          handleHexChange(cleanHex);
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard read permission denied or failed, falling back to prompt:', err);
    }
    const input = prompt('Please paste a hex color code (e.g. #FFCC00):', pickerHex());
    if (input) {
      let cleanHex = input.trim();
      if (!cleanHex.startsWith('#')) {
        cleanHex = '#' + cleanHex;
      }
      if (cleanHex.match(/^#[0-9A-Fa-f]{6}$/)) {
        handleHexChange(cleanHex);
      } else {
        alert('Invalid HEX format. Please use #RRGGBB or RRGGBB.');
      }
    }
  };

  let padRef: HTMLDivElement | undefined;

  // Auto-default active editing stop to first stop
  createEffect(() => {
    const stops = customStops();
    if (stops.length > 0) {
      const activeId = activeColorPickerStopId();
      if (activeId === null || !stops.some(s => s.id === activeId)) {
        setActiveColorPickerStopId(stops[0].id);
      }
    }
  });

  // Sync color picker values when selected stop changes
  createEffect(() => {
    const stopId = activeColorPickerStopId();
    if (stopId !== null) {
      const stop = customStops().find(s => s.id === stopId);
      if (stop) {
        const hex = stop.color;
        setPickerHex(hex);
        const rgb = hexToRgb(hex);
        setPickerR(rgb.r);
        setPickerG(rgb.g);
        setPickerB(rgb.b);
        const hsl = hexToHsl(hex);
        setPickerH(hsl.h);
        setPickerS(hsl.s);
        setPickerL(hsl.l);
      }
    }
  });

  // Sync softbox parameters to root CSS variables for dynamic HTML sheen elements
  createEffect(() => {
    if (typeof document === 'undefined') return;
    
    const w = boxWidth();
    const h = boxHeight();
    const blur = boxBlur();
    const radius = boxCornerRadius();
    const color = boxColor();
    const opacity = boxOpacity();
    const blendMode = boxMixBlendMode();
    const type = customType();
    
    // 1. Compile box background SVG data-URI
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><filter id="b" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><rect x="${50 - w/2}" y="${50 - h/2}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${encodeURIComponent(color)}" opacity="${opacity}" filter="url(%23b)"/></svg>`;
    const dataUri = `url('data:image/svg+xml;utf8,${svg}')`;
    
    document.documentElement.style.setProperty('--box-bg-image', dataUri);
    document.documentElement.style.setProperty('--box-blend-mode', blendMode);
    
    // 2. Set dynamic rich-text background image based on customType()
    if (type === 'radial') {
      document.documentElement.style.setProperty(
        '--rich-sheen-bg-image', 
        `radial-gradient(circle at calc(50% + var(--reflex-x) * 30%) calc(50% + var(--reflex-y) * 30%), var(--highlight-color) 0%, transparent 60%)`
      );
      document.documentElement.style.setProperty('--rich-sheen-blend-mode', 'overlay');
    } else if (type === 'box') {
      document.documentElement.style.setProperty('--rich-sheen-bg-image', dataUri);
      document.documentElement.style.setProperty('--rich-sheen-blend-mode', blendMode);
    } else {
      // Linear or default: remove variable values so it falls back to index.css defaults
      document.documentElement.style.removeProperty('--rich-sheen-bg-image');
      document.documentElement.style.removeProperty('--rich-sheen-blend-mode');
    }
  });

  const updateStopColor = (hex: string) => {
    const stopId = activeColorPickerStopId();
    if (stopId !== null) {
      setCustomStops(customStops().map(s => s.id === stopId ? { ...s, color: hex } : s));
    }
  };

  const handleHslChange = (h: number, s: number, l: number) => {
    setPickerH(h);
    setPickerS(s);
    setPickerL(l);
    const hex = hslToHex(h, s, l);
    setPickerHex(hex);
    const rgb = hslToRgb(h, s, l);
    setPickerR(rgb.r);
    setPickerG(rgb.g);
    setPickerB(rgb.b);
    updateStopColor(hex);
  };

  const handleRgbChange = (r: number, g: number, b: number) => {
    setPickerR(r);
    setPickerG(g);
    setPickerB(b);
    const hex = rgbToHex(r, g, b);
    setPickerHex(hex);
    const hsl = rgbToHsl(r, g, b);
    setPickerH(hsl.h);
    setPickerS(hsl.s);
    setPickerL(hsl.l);
    updateStopColor(hex);
  };

  const handleHexChange = (hex: string) => {
    setPickerHex(hex);
    if (hex.match(/^#[0-9A-Fa-f]{6}$/)) {
      const rgb = hexToRgb(hex);
      setPickerR(rgb.r);
      setPickerG(rgb.g);
      setPickerB(rgb.b);
      const hsl = hexToHsl(hex);
      setPickerH(hsl.h);
      setPickerS(hsl.s);
      setPickerL(hsl.l);
      updateStopColor(hex);
    }
  };

  const updateColorMode = (mode: 'HEX' | 'HSL' | 'RGB') => {
    setColorMode(mode);
    localStorage.setItem('crueldeal-color-picker-mode', mode);
  };

  const handlePadMouseDown = (e: MouseEvent) => {
    const padEl = e.currentTarget as HTMLDivElement;
    if (!padEl) return;
    e.preventDefault();
    
    const updateFromEvent = (clientX: number, clientY: number) => {
      const rect = padEl.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
      
      const s = Math.round(x * 100);
      const l = Math.round(y * 100);
      handleHslChange(pickerH(), s, l);
    };

    updateFromEvent(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromEvent(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const isRadialActive = () => {
    return customType() === 'radial' || ['R1', 'R2'].includes(gradientProfile());
  };

  const [customStops, setCustomStops] = createSignal<Array<{ id: number, offset: number, color: string }>>([
    { id: 1, offset: 0, color: '#7C6535' },
    { id: 2, offset: 8, color: '#997E47' },
    { id: 3, offset: 26, color: '#B8A269' },
    { id: 4, offset: 30, color: '#7C6535' },
    { id: 5, offset: 34, color: '#FFFDDA' },
    { id: 6, offset: 60, color: '#D5BB8A' },
    { id: 7, offset: 81, color: '#B8A269' },
    { id: 8, offset: 85, color: '#7C6535' },
    { id: 9, offset: 93, color: '#FBECA9' },
    { id: 10, offset: 100, color: '#7C6535' }
  ]);

  const gradCoords = (customX?: number, customY?: number) => {
    const rad = (gradientAngle() * Math.PI) / 180;
    const cx = 50;
    const cy = 50;
    const r = 50 * Math.sqrt(2) * gradientScale();
    
    const baseX1 = cx - r * Math.cos(rad);
    const baseY1 = cy - r * Math.sin(rad);
    const baseX2 = cx + r * Math.cos(rad);
    const baseY2 = cy + r * Math.sin(rad);
    
    const shiftX = gradientShift() * Math.cos(rad);
    const shiftY = gradientShift() * Math.sin(rad);
    
    const activeX = customX !== undefined ? customX : (interactiveSheen() ? interactiveShiftX() : 0);
    const activeY = customY !== undefined ? customY : (interactiveSheen() ? interactiveShiftY() : 0);
    
    return {
      x1: baseX1 + shiftX + activeX,
      y1: baseY1 + shiftY + activeY,
      x2: baseX2 + shiftX + activeX,
      y2: baseY2 + shiftY + activeY
    };
  };

  const radialCoords = (customX?: number, customY?: number) => {
    const rad = (gradientAngle() * Math.PI) / 180;
    const r = 50 * gradientScale();
    const activeX = customX !== undefined ? customX : (interactiveSheen() ? interactiveShiftX() : 0);
    const activeY = customY !== undefined ? customY : (interactiveSheen() ? interactiveShiftY() : 0);
    const fx = 50 + activeX + (gradientShift() * Math.cos(rad));
    const fy = 50 + activeY + (gradientShift() * Math.sin(rad));
    return { cx: 50, cy: 50, r, fx, fy };
  };

  const stopsCssString = () => {
    const sorted = [...customStops()].sort((a, b) => a.offset - b.offset);
    if (sorted.length === 0) return '#55411B 0%, #D5BB8A 100%';
    return sorted.map(s => `${s.color} ${s.offset}%`).join(', ');
  };


  const textureFiles = Array.from({ length: 25 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    return `Gold${num}.png`;
  });

  // Signals for clipboard & save/load system
  const [copiedType, setCopiedType] = createSignal<'thin' | 'medium' | 'thick' | null>(null);
  const [savedFeedback, setSavedFeedback] = createSignal<string | null>(null);
  const [selectedSlotThin, setSelectedSlotThin] = createSignal('1');
  const [selectedSlotMedium, setSelectedSlotMedium] = createSignal('1');
  const [selectedSlotThick, setSelectedSlotThick] = createSignal('1');
  const [slotStatus, setSlotStatus] = createSignal(Date.now());

  const pngVariations = [
    {
      id: 'original',
      name: 'Shiny Gold Solid Hex',
      desc: 'The original 3D render with a shiny gold surface and flat bottom.',
      src: '/icons/icon_original.png',
    },
    {
      id: 'bold',
      name: 'Variation 1: Bold Gold K',
      desc: 'Thicker gold hexagon border, black inner face, and a bold gold K in the center.',
      src: '/icons/icon_bold.png',
    },
    {
      id: 'thin',
      name: 'Variation 2: Thin Gold K',
      desc: 'Thin gold hexagon border, black inner face, and a thin line-art gold K.',
      src: '/icons/icon_thin.png',
    },
    {
      id: 'thick',
      name: 'Variation 3: Heavy Gold K',
      desc: 'Extra-wide chunky gold border, black inner face, and a heavy-stroke K.',
      src: '/icons/icon_thick.png',
    },
    {
      id: 'solid',
      name: 'Variation 4: Solid Gold / Black K',
      desc: 'A full gold face with a debossed/engraved black enamel K in the center.',
      src: '/icons/icon_solid.png',
    },
    {
      id: 'dual',
      name: 'Variation 5: Concentric Gold Border',
      desc: 'Double gold hexagon rings separated by a thin gap, with a black inner face.',
      src: '/icons/icon_dual.png',
    },
  ];

  // SVG Presets
  const applyPreset = (preset: 'thin' | 'medium' | 'thick' | 'triple') => {
    // Reset diagonal positions and offsets to default
    setKDiagWidth(24);
    setKDiag1Slope(1.08);
    setKDiag2Slope(0.71);
    setKDiag2X(-7);
    setKOffsetX(0);
    setKOffsetY(0);

    if (preset === 'thin') {
      setThickness(3);
      setKThickness(3);
      setHexFillOpacity(0);
      setGlowIntensity(0);
      setLinecap('butt');
      setRings(1);
      setRingGap(6);
      setKScale(1.0);
      setBevelOffset(0.3);
      setBevelOpacity(0.4);
      setKBlockMode(false);
    } else if (preset === 'medium') {
      setThickness(6);
      setKThickness(6);
      setHexFillOpacity(0.08);
      setGlowIntensity(0);
      setLinecap('butt');
      setRings(1);
      setRingGap(8);
      setKScale(1.0);
      setBevelOffset(0.6);
      setBevelOpacity(0.6);
      setKBlockMode(false);
    } else if (preset === 'thick') {
      setThickness(10);
      setKThickness(16);
      setHexFillOpacity(0.12);
      setGlowIntensity(0);
      setLinecap('butt');
      setRings(1);
      setRingGap(10);
      setKScale(0.9);
      setBevelOffset(1.2);
      setBevelOpacity(0.8);
      setKBlockMode(true);
    } else if (preset === 'triple') {
      setThickness(4);
      setKThickness(4);
      setHexFillOpacity(0);
      setGlowIntensity(0);
      setLinecap('butt');
      setRings(3);
      setRingGap(5.5);
      setKScale(0.85); // Make K slightly smaller so it sits perfectly inside triple rings
      setBevelOffset(0.4);
      setBevelOpacity(0.5);
      setKBlockMode(false);
    }
  };

  const getSVGMarkupString = (type: 'thin' | 'medium' | 'thick') => {
    const borderStrokeWidth = () => {
      const base = thickness();
      if (type === 'thin') return Math.max(1, base - 3);
      if (type === 'thick') return base + 4;
      return base;
    };

    const currentKStrokeWidth = () => {
      const base = kThickness();
      if (type === 'thin') return Math.max(1, base - 3);
      if (type === 'thick') return base + 4;
      return base;
    };

    const c = getKCoords(kScale(), currentKStrokeWidth(), linecap());
    const fillSourceStr = fillMode() === 'gradient' ? 'url(#gold)' : 'url(#gold-texture)';
    const paintDef = fillMode() === 'gradient'
      ? (customType() === 'box'
        ? `    <filter id="softbox-blur" x="-100%" y="-100%" width="300%" height="300%">\n      <feGaussianBlur stdDeviation="${boxBlur()}" />\n    </filter>\n    <linearGradient id="gold-box-base-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">\n${getGradientStopsString()}\n    </linearGradient>\n    <pattern id="gold" patternUnits="userSpaceOnUse" width="100" height="100">\n      <rect width="100" height="100" fill="url(#gold-box-base-grad)" />\n      <rect x="${(50 - boxWidth() / 2).toFixed(1)}" y="${(50 - boxHeight() / 2).toFixed(1)}" width="${boxWidth()}" height="${boxHeight()}" rx="${boxCornerRadius()}" ry="${boxCornerRadius()}" fill="${boxColor()}" opacity="${boxOpacity()}" filter="url(#softbox-blur)" style="mix-blend-mode: ${boxMixBlendMode()};" />\n    </pattern>`
        : (isRadialActive()
          ? `    <radialGradient id="gold" cx="50.0" cy="50.0" r="${(50 * gradientScale()).toFixed(1)}" fx="${(50 + gradientShift() * Math.cos((gradientAngle() * Math.PI) / 180)).toFixed(1)}" fy="${(50 + gradientShift() * Math.sin((gradientAngle() * Math.PI) / 180)).toFixed(1)}" gradientUnits="userSpaceOnUse">\n${getGradientStopsString()}\n    </radialGradient>`
          : `    <linearGradient id="gold" x1="${gradCoords().x1.toFixed(1)}" y1="${gradCoords().y1.toFixed(1)}" x2="${gradCoords().x2.toFixed(1)}" y2="${gradCoords().y2.toFixed(1)}" gradientUnits="userSpaceOnUse" spreadMethod="reflect">\n${getGradientStopsString()}\n    </linearGradient>`))
      : `    <pattern id="gold-texture" patternUnits="userSpaceOnUse" x="${textureOffsetX()}" y="${textureOffsetY()}" width="${(100 * textureScale()).toFixed(1)}" height="${(100 * textureScale()).toFixed(1)}">\n      <image href="/gold-textures/${selectedTexture()}" x="0" y="0" width="${(100 * textureScale()).toFixed(1)}" height="${(100 * textureScale()).toFixed(1)}" preserveAspectRatio="xMidYMid slice" style="filter: brightness(${textureBrightness()});" />\n    </pattern>`;

    const overlayGradDef = fillMode() === 'texture' && overlayOpacity() > 0
      ? (customType() === 'box'
        ? `\n    <filter id="softbox-blur" x="-100%" y="-100%" width="300%" height="300%">\n      <feGaussianBlur stdDeviation="${boxBlur()}" />\n    </filter>\n    <linearGradient id="gold-box-base-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">\n${getGradientStopsString()}\n    </linearGradient>\n    <pattern id="gold-grad-overlay" patternUnits="userSpaceOnUse" width="100" height="100">\n      <rect width="100" height="100" fill="url(#gold-box-base-grad)" />\n      <rect x="${(50 - boxWidth() / 2).toFixed(1)}" y="${(50 - boxHeight() / 2).toFixed(1)}" width="${boxWidth()}" height="${boxHeight()}" rx="${boxCornerRadius()}" ry="${boxCornerRadius()}" fill="${boxColor()}" opacity="${boxOpacity()}" filter="url(#softbox-blur)" style="mix-blend-mode: ${boxMixBlendMode()};" />\n    </pattern>`
        : (isRadialActive()
          ? `\n    <radialGradient id="gold-grad-overlay" cx="50.0" cy="50.0" r="${(50 * gradientScale()).toFixed(1)}" fx="${(50 + gradientShift() * Math.cos((gradientAngle() * Math.PI) / 180)).toFixed(1)}" fy="${(50 + gradientShift() * Math.sin((gradientAngle() * Math.PI) / 180)).toFixed(1)}" gradientUnits="userSpaceOnUse">\n${getGradientStopsString()}\n    </radialGradient>`
          : `\n    <linearGradient id="gold-grad-overlay" x1="${gradCoords().x1.toFixed(1)}" y1="${gradCoords().y1.toFixed(1)}" x2="${gradCoords().x2.toFixed(1)}" y2="${gradCoords().y2.toFixed(1)}" gradientUnits="userSpaceOnUse" spreadMethod="reflect">\n${getGradientStopsString()}\n    </linearGradient>`))
      : '';

    // 1. Polygons - Shadow
    const polygonShadows = Array.from({ length: rings() }, (_, i) => i).map((index) => {
      const fillAttr = index === 0 && hexFillOpacity() > 0 ? ` fill="#201A0A" fill-opacity="${hexFillOpacity()}"` : ' fill="none"';
      return `<polygon points="${getHexagonPoints(index, borderStrokeWidth())}" stroke="#201A0A" stroke-width="${(borderStrokeWidth() + bevelOffset() * 1.5).toFixed(2)}" ${fillAttr} stroke-linejoin="${linecap() === 'round' ? 'round' : 'miter'}" transform="translate(${bevelOffset().toFixed(2)}, ${bevelOffset().toFixed(2)})"/>`;
    }).join('\n  ');

    // 2. Polygons - Highlight
    const polygonHighlights = Array.from({ length: rings() }, (_, i) => i).map((index) => {
      return `<polygon points="${getHexagonPoints(index, borderStrokeWidth())}" stroke="#FFFDDA" stroke-width="${(borderStrokeWidth() + bevelOffset() * 0.5).toFixed(2)}" fill="none" stroke-linejoin="${linecap() === 'round' ? 'round' : 'miter'}" transform="translate(${-bevelOffset().toFixed(2)}, ${-bevelOffset().toFixed(2)})" opacity="${bevelOpacity().toFixed(2)}"/>`;
    }).join('\n  ');

    // 3. Polygons - Main Face
    const polygonMains = Array.from({ length: rings() }, (_, i) => i).map((index) => {
      const fillAttr = index === 0 && hexFillOpacity() > 0 ? ` fill="${fillSourceStr}" fill-opacity="${hexFillOpacity()}"` : ' fill="none"';
      return `<polygon points="${getHexagonPoints(index, borderStrokeWidth())}" stroke="${fillSourceStr}" stroke-width="${borderStrokeWidth().toFixed(2)}" ${fillAttr} stroke-linejoin="${linecap() === 'round' ? 'round' : 'miter'}"/>`;
    }).join('\n  ');

    // 4. K Shadows
    const stemShadow = `<path d="M ${c.stemX1},${c.stemY1} L ${c.stemX2},${c.stemY2}" fill="none" stroke="#201A0A" stroke-width="${(currentKStrokeWidth() + bevelOffset() * 1.5).toFixed(2)}" stroke-linecap="${linecap()}" transform="translate(${bevelOffset().toFixed(2)}, ${bevelOffset().toFixed(2)})"/>`;
    const diagShadow = `<g clip-path="url(#k-clip)">
    <path d="M ${c.diag1X1},${c.diag1Y1} L ${c.diag1X2},${c.diag1Y2}" fill="none" stroke="#201A0A" stroke-width="${(currentKStrokeWidth() + bevelOffset() * 1.5).toFixed(2)}" stroke-linecap="${linecap()}" stroke-linejoin="miter" transform="translate(${bevelOffset().toFixed(2)}, ${bevelOffset().toFixed(2)})"/>
    <path d="M ${c.diag2X1},${c.diag2Y1} L ${c.diag2X2},${c.diag2Y2}" fill="none" stroke="#201A0A" stroke-width="${(currentKStrokeWidth() + bevelOffset() * 1.5).toFixed(2)}" stroke-linecap="${linecap()}" stroke-linejoin="miter" transform="translate(${bevelOffset().toFixed(2)}, ${bevelOffset().toFixed(2)})"/>
  </g>`;

    // 5. K Highlights
    const stemHighlight = `<path d="M ${c.stemX1},${c.stemY1} L ${c.stemX2},${c.stemY2}" fill="none" stroke="#FFFDDA" stroke-width="${(currentKStrokeWidth() + bevelOffset() * 0.5).toFixed(2)}" stroke-linecap="${linecap()}" transform="translate(${-bevelOffset().toFixed(2)}, ${-bevelOffset().toFixed(2)})" opacity="${bevelOpacity().toFixed(2)}"/>`;
    const diagHighlight = `<g clip-path="url(#k-clip)">
    <path d="M ${c.diag1X1},${c.diag1Y1} L ${c.diag1X2},${c.diag1Y2}" fill="none" stroke="#FFFDDA" stroke-width="${(currentKStrokeWidth() + bevelOffset() * 0.5).toFixed(2)}" stroke-linecap="${linecap()}" stroke-linejoin="miter" transform="translate(${-bevelOffset().toFixed(2)}, ${-bevelOffset().toFixed(2)})" opacity="${bevelOpacity().toFixed(2)}"/>
    <path d="M ${c.diag2X1},${c.diag2Y1} L ${c.diag2X2},${c.diag2Y2}" fill="none" stroke="#FFFDDA" stroke-width="${(currentKStrokeWidth() + bevelOffset() * 0.5).toFixed(2)}" stroke-linecap="${linecap()}" stroke-linejoin="miter" transform="translate(${-bevelOffset().toFixed(2)}, ${-bevelOffset().toFixed(2)})" opacity="${bevelOpacity().toFixed(2)}"/>
  </g>`;

    // 6. K Mains
    const stemMain = `<path d="M ${c.stemX1},${c.stemY1} L ${c.stemX2},${c.stemY2}" fill="none" stroke="${fillSourceStr}" stroke-width="${currentKStrokeWidth()}" stroke-linecap="${linecap()}"/>`;
    const diagMain = `<g clip-path="url(#k-clip)">
    <path d="M ${c.diag1X1},${c.diag1Y1} L ${c.diag1X2},${c.diag1Y2}" fill="none" stroke="${fillSourceStr}" stroke-width="${currentKStrokeWidth()}" stroke-linecap="${linecap()}" stroke-linejoin="miter"/>
    <path d="M ${c.diag2X1},${c.diag2Y1} L ${c.diag2X2},${c.diag2Y2}" fill="none" stroke="${fillSourceStr}" stroke-width="${currentKStrokeWidth()}" stroke-linecap="${linecap()}" stroke-linejoin="miter"/>
  </g>`;

    // 7. Texture Overlay
    let textureOverlay = '';
    if (fillMode() === 'texture' && overlayOpacity() > 0) {
      const overlayColor = `url(#gold-grad-overlay)`;
      const overlayPolys = Array.from({ length: rings() }, (_, i) => i).map((index) => {
        const fillAttr = index === 0 && hexFillOpacity() > 0 ? ` fill="${overlayColor}" fill-opacity="${hexFillOpacity()}"` : ' fill="none"';
        return `<polygon points="${getHexagonPoints(index, borderStrokeWidth())}" stroke="${overlayColor}" stroke-width="${borderStrokeWidth().toFixed(2)}" ${fillAttr} stroke-linejoin="${linecap() === 'round' ? 'round' : 'miter'}" style="mix-blend-mode: ${overlayBlendMode()}; opacity: ${overlayOpacity()}; pointer-events: none;"/>`;
      }).join('\n  ');
      const overlayStem = `<path d="M ${c.stemX1},${c.stemY1} L ${c.stemX2},${c.stemY2}" fill="none" stroke="${overlayColor}" stroke-width="${currentKStrokeWidth()}" stroke-linecap="${linecap()}" style="mix-blend-mode: ${overlayBlendMode()}; opacity: ${overlayOpacity()}; pointer-events: none;"/>`;
      const overlayDiag = `<g clip-path="url(#k-clip)">
    <path d="M ${c.diag1X1},${c.diag1Y1} L ${c.diag1X2},${c.diag1Y2}" fill="none" stroke="${overlayColor}" stroke-width="${currentKStrokeWidth()}" stroke-linecap="${linecap()}" stroke-linejoin="miter" style="mix-blend-mode: ${overlayBlendMode()}; opacity: ${overlayOpacity()}; pointer-events: none;"/>
    <path d="M ${c.diag2X1},${c.diag2Y1} L ${c.diag2X2},${c.diag2Y2}" fill="none" stroke="${overlayColor}" stroke-width="${currentKStrokeWidth()}" stroke-linecap="${linecap()}" stroke-linejoin="miter" style="mix-blend-mode: ${overlayBlendMode()}; opacity: ${overlayOpacity()}; pointer-events: none;"/>
  </g>`;
      textureOverlay = `\n  ${overlayPolys}\n  ${overlayStem}\n  ${overlayDiag}`;
    }

    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
${paintDef}${overlayGradDef}
    <clipPath id="k-clip"><rect x="10" y="${c.clipY}" width="80" height="${c.clipHeight}" /></clipPath>
  </defs>
  ${polygonShadows}
  ${polygonHighlights}
  ${polygonMains}
  ${stemShadow}
  ${diagShadow}
  ${stemHighlight}
  ${diagHighlight}
  ${stemMain}
  ${diagMain}${textureOverlay}
</svg>`;
  };

  const handleCopySVG = (viewType: 'thin' | 'medium' | 'thick') => {
    const markup = getSVGMarkupString(viewType);
    navigator.clipboard.writeText(markup).then(() => {
      setCopiedType(viewType);
      setTimeout(() => {
        if (copiedType() === viewType) {
          setCopiedType(null);
        }
      }, 2000);
    });
  };

  const savePreset = (viewType: 'thin' | 'medium' | 'thick', slotNum: string) => {
    let t = thickness();
    let kt = kThickness();
    
    if (viewType === 'thin') {
      t = Math.max(1, t - 3);
      kt = Math.max(1, kt - 3);
    } else if (viewType === 'thick') {
      t = t + 4;
      kt = kt + 4;
    }
    
    const preset = {
      thickness: t,
      kThickness: kt,
      hexFillOpacity: hexFillOpacity(),
      glowIntensity: glowIntensity(),
      linecap: linecap(),
      rings: rings(),
      ringGap: ringGap(),
      kScale: kScale(),
      gradientProfile: gradientProfile(),
      kOffsetX: kOffsetX(),
      kOffsetY: kOffsetY(),
      kDiag2X: kDiag2X(),
      kDiag1Slope: kDiag1Slope(),
      kDiag2Slope: kDiag2Slope(),
      textureScale: textureScale(),
      textureOffsetX: textureOffsetX(),
      textureOffsetY: textureOffsetY(),
      textureBrightness: textureBrightness(),
      textureContrast: textureContrast(),
      textureSaturation: textureSaturation(),
      overlayOpacity: overlayOpacity(),
      overlayBlendMode: overlayBlendMode(),
      bevelOffset: bevelOffset(),
      bevelOpacity: bevelOpacity(),
      kBlockMode: kBlockMode(),
    };
    
    localStorage.setItem(`crueldeal_icon_preset_${slotNum}`, JSON.stringify(preset));
    setSlotStatus(Date.now());
    
    setSavedFeedback(`${viewType}-${slotNum}`);
    setTimeout(() => {
      if (savedFeedback() === `${viewType}-${slotNum}`) {
        setSavedFeedback(null);
      }
    }, 2000);
  };

  const loadPreset = (slotNum: string) => {
    const raw = localStorage.getItem(`crueldeal_icon_preset_${slotNum}`);
    if (!raw) {
      alert(`No saved configuration found in Slot ${slotNum}!`);
      return;
    }
    try {
      const preset = JSON.parse(raw);
      if (preset.thickness !== undefined) setThickness(preset.thickness);
      if (preset.kThickness !== undefined) setKThickness(preset.kThickness);
      if (preset.hexFillOpacity !== undefined) setHexFillOpacity(preset.hexFillOpacity);
      if (preset.glowIntensity !== undefined) setGlowIntensity(preset.glowIntensity);
      if (preset.linecap !== undefined) setLinecap(preset.linecap);
      if (preset.rings !== undefined) setRings(preset.rings);
      if (preset.ringGap !== undefined) setRingGap(preset.ringGap);
      if (preset.kScale !== undefined) setKScale(preset.kScale);
      if (preset.gradientProfile !== undefined) setGradientProfile(preset.gradientProfile);
      if (preset.kOffsetX !== undefined) setKOffsetX(preset.kOffsetX);
      else setKOffsetX(0);
      if (preset.kOffsetY !== undefined) setKOffsetY(preset.kOffsetY);
      else setKOffsetY(0);
      if (preset.kDiag2X !== undefined) setKDiag2X(preset.kDiag2X);
      else setKDiag2X(-7);
      if (preset.kDiag1Slope !== undefined) setKDiag1Slope(preset.kDiag1Slope);
      else setKDiag1Slope(1.08);
      if (preset.kDiag2Slope !== undefined) setKDiag2Slope(preset.kDiag2Slope);
      else setKDiag2Slope(0.71);
      if (preset.textureScale !== undefined) setTextureScale(preset.textureScale);
      else setTextureScale(1.0);
      if (preset.textureOffsetX !== undefined) setTextureOffsetX(preset.textureOffsetX);
      else setTextureOffsetX(0);
      if (preset.textureOffsetY !== undefined) setTextureOffsetY(preset.textureOffsetY);
      else setTextureOffsetY(0);
      if (preset.textureBrightness !== undefined) setTextureBrightness(preset.textureBrightness);
      else setTextureBrightness(1.0);
      if (preset.textureContrast !== undefined) setTextureContrast(preset.textureContrast);
      else setTextureContrast(1.0);
      if (preset.textureSaturation !== undefined) setTextureSaturation(preset.textureSaturation);
      else setTextureSaturation(1.0);
      if (preset.overlayOpacity !== undefined) setOverlayOpacity(preset.overlayOpacity);
      else setOverlayOpacity(0.4);
      if (preset.overlayBlendMode !== undefined) setOverlayBlendMode(preset.overlayBlendMode);
      else setOverlayBlendMode('overlay');
      if (preset.bevelOffset !== undefined) setBevelOffset(preset.bevelOffset);
      else setBevelOffset(0.6);
      if (preset.bevelOpacity !== undefined) setBevelOpacity(preset.bevelOpacity);
      else setBevelOpacity(0.6);
      if (preset.kBlockMode !== undefined) setKBlockMode(preset.kBlockMode);
      else setKBlockMode(false);
    } catch (e) {
      console.error("Error parsing preset", e);
    }
  };

  const checkSlotText = (slotNum: string) => {
    slotStatus();
    return localStorage.getItem(`crueldeal_icon_preset_${slotNum}`) 
      ? `Slot ${slotNum} (Saved)` 
      : `Slot ${slotNum} (Empty)`;
  };

  // Helper to calculate exact coordinates for concentric hexagons with mathematically uniform gaps.
  const getHexagonPoints = (index: number, strokeWidth: number) => {
    const baseRadius = 45;
    const gap = ringGap(); 
    const H_0 = baseRadius * 0.866025; // Height of base hexagon
    const H_i = H_0 - index * gap;
    const R_i = H_i / 0.866025; // Adjusted radius
    const h = H_i;
    
    return `${(50 - R_i/2).toFixed(2)}, ${(50 - h).toFixed(2)} ${(50 + R_i/2).toFixed(2)}, ${(50 - h).toFixed(2)} ${(50 + R_i).toFixed(2)}, 50 ${(50 + R_i/2).toFixed(2)}, ${(50 + h).toFixed(2)} ${(50 - R_i/2).toFixed(2)}, ${(50 + h).toFixed(2)} ${(50 - R_i).toFixed(2)}, 50`;
  };

  // Helper to calculate K coordinates dynamically based on scaling factor S, thickness, and linecap.
  // This allows the K size to be modified while keeping the stroke width independent of the borders.
  const getKCoords = (S: number, kThick: number, capStyle: 'butt' | 'round') => {
    const startX = 50 - 12 * S + kOffsetX();
    const y1 = 50 - 22 * S + kOffsetY();
    const y2 = 50 + 22 * S + kOffsetY();
    // For rounded line caps, the vertical line extends past y1 and y2 by half the stroke width.
    // The clipping path y and height are adjusted to match the line ends perfectly.
    const offset = capStyle === 'round' ? kThick / 2 : 0;
    
    // Anchors for the outer tips (ends of the arms at the clip boundaries)
    const y_anchor1 = y1 - offset;
    const y_anchor2 = y2 + offset;
    const x_anchor1 = startX + kDiagWidth() * S;
    const x_anchor2 = startX + kDiagWidth() * S;

    // Upper diagonal (diag1) starts on the vertical stem (startX)
    // Its Y-start is calculated so that the line passes through (x_anchor1, y_anchor1) at kDiag1Slope()
    const diag1Y1Val = y_anchor1 + (x_anchor1 - startX) / kDiag1Slope();
    const diag1X1Val = startX;

    // Lower diagonal (diag2) starts at an adjustable X-position (diag2X1Val)
    // Its Y-start is calculated so that the line passes through (x_anchor2, y_anchor2) at kDiag2Slope()
    const diag2X1Val = 50 + kDiag2X() * S + kOffsetX();
    const diag2Y1Val = y_anchor2 - (x_anchor2 - diag2X1Val) / kDiag2Slope();

    // Extend centerlines past the anchors to ensure clean horizontal clipping of the stroke widths
    const ext = kThick * 1.5 + 4;
    const diag1Y2Val = y_anchor1 - ext;
    const diag1X2Val = x_anchor1 + ext * kDiag1Slope();
    
    const diag2Y2Val = y_anchor2 + ext;
    const diag2X2Val = x_anchor2 + ext * kDiag2Slope();
    
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

  const getGradientStopsString = () => {
    if (gradientProfile() === 'A') {
      return `      <stop offset="0%" stop-color="#FFF3C2" />
      <stop offset="25%" stop-color="#E2B857" />
      <stop offset="50%" stop-color="#FCF6BA" />
      <stop offset="75%" stop-color="#B28424" />
      <stop offset="100%" stop-color="#FCD267" />`;
    }
    if (gradientProfile() === 'B') {
      return `      <stop offset="0%" stop-color="#251502" />
      <stop offset="25%" stop-color="#E5B842" />
      <stop offset="50%" stop-color="#FFF7C7" />
      <stop offset="75%" stop-color="#E5B842" />
      <stop offset="100%" stop-color="#251502" />`;
    }
    if (gradientProfile() === 'C') {
      return `      <stop offset="0%" stop-color="#FFF2C2" />
      <stop offset="30%" stop-color="#C5A44E" />
      <stop offset="50%" stop-color="#A48748" />
      <stop offset="70%" stop-color="#EDCD75" />
      <stop offset="100%" stop-color="#B7984A" />`;
    }
    if (gradientProfile() === 'D') {
      return `      <stop offset="0%" stop-color="#EBEFF5" />
      <stop offset="25%" stop-color="#B5B9BF" />
      <stop offset="50%" stop-color="#EDF1F7" />
      <stop offset="75%" stop-color="#83878D" />
      <stop offset="100%" stop-color="#CED2D8" />`;
    }
    if (gradientProfile() === 'E') {
      return `      <stop offset="0%" stop-color="#D1D5DB" />
      <stop offset="30%" stop-color="#6B7280" />
      <stop offset="50%" stop-color="#374151" />
      <stop offset="70%" stop-color="#9CA3AF" />
      <stop offset="100%" stop-color="#4B5563" />`;
    }
    if (gradientProfile() === 'G') {
      return `      <stop offset="0%" stop-color="#55411B" />
      <stop offset="8%" stop-color="#997E47" />
      <stop offset="26%" stop-color="#B8A269" />
      <stop offset="30%" stop-color="#55411B" />
      <stop offset="34%" stop-color="#FFFDDA" />
      <stop offset="60%" stop-color="#D5BB8A" />
      <stop offset="81%" stop-color="#B8A269" />
      <stop offset="85%" stop-color="#55411B" />
      <stop offset="93%" stop-color="#FBECA9" />
      <stop offset="100%" stop-color="#55411B" />`;
    }
    if (gradientProfile() === 'I') {
      return `      <stop offset="0%" stop-color="#7C6535" />
      <stop offset="8%" stop-color="#997E47" />
      <stop offset="26%" stop-color="#B8A269" />
      <stop offset="30%" stop-color="#7C6535" />
      <stop offset="34%" stop-color="#FFFDDA" />
      <stop offset="60%" stop-color="#D5BB8A" />
      <stop offset="81%" stop-color="#B8A269" />
      <stop offset="85%" stop-color="#7C6535" />
      <stop offset="89%" stop-color="#FBECA9" />
      <stop offset="100%" stop-color="#D5BB8A" />`;
    }
    if (gradientProfile() === 'J') {
      return `      <stop offset="0%" stop-color="#7C6535" />
      <stop offset="8%" stop-color="#997E47" />
      <stop offset="26%" stop-color="#B8A269" />
      <stop offset="30%" stop-color="#7C6535" />
      <stop offset="34%" stop-color="#FFFDDA" />
      <stop offset="60%" stop-color="#D5BB8A" />
      <stop offset="81%" stop-color="#B8A269" />
      <stop offset="85%" stop-color="#7C6535" />
      <stop offset="93%" stop-color="#FBECA9" />
      <stop offset="100%" stop-color="#7C6535" />`;
    }
    if (gradientProfile() === 'K') {
      return `      <stop offset="0%" stop-color="#FFFDDA" />
      <stop offset="31%" stop-color="#D5BB8A" />
      <stop offset="44%" stop-color="#7C6535" />
      <stop offset="100%" stop-color="#55411B" />`;
    }
    if (gradientProfile() === 'R1') {
      return `      <stop offset="0%" stop-color="#FFFDDA" />
      <stop offset="15%" stop-color="#D5BB8A" />
      <stop offset="35%" stop-color="#7C6535" />
      <stop offset="55%" stop-color="#FFFDDA" />
      <stop offset="75%" stop-color="#D5BB8A" />
      <stop offset="90%" stop-color="#7C6535" />
      <stop offset="100%" stop-color="#55411B" />`;
    }
    if (gradientProfile() === 'R2') {
      return `      <stop offset="0%" stop-color="#FFFDDA" />
      <stop offset="25%" stop-color="#D5BB8A" />
      <stop offset="60%" stop-color="#7C6535" />
      <stop offset="100%" stop-color="#55411B" />`;
    }
    if (gradientProfile() === 'Custom') {
      const sorted = [...customStops()].sort((a, b) => a.offset - b.offset);
      return sorted.map(stop => `      <stop offset="${stop.offset}%" stop-color="${stop.color}" />`).join('\n');
    }
    return `      <stop offset="0%" stop-color="#9CA3AF" />
      <stop offset="25%" stop-color="#4B5563" />
      <stop offset="50%" stop-color="#1F2937" />
      <stop offset="75%" stop-color="#111827" />
      <stop offset="100%" stop-color="#374151" />`;
  };

  return (
    <main class="h-full w-full overflow-y-auto bg-[#07080b] text-[#e2e8f0] font-sans antialiased p-8 pb-16 custom-scrollbar">
      {/* Background neon grid effect */}
      <div class="fixed inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div class="fixed top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div class="max-w-6xl mx-auto relative z-10">
        
        {/* Header */}
        <header class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 mb-10 gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 text-[10px] font-mono tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded uppercase">Asset Foundry</span>
              <span class="text-white/40 text-xs">/</span>
              <span class="text-white/60 text-xs font-mono">dev/icons</span>
            </div>
            <h1 class="text-3xl font-bold tracking-tight text-white bg-gradient-to-r from-white via-[#f3c868] to-amber-500 bg-clip-text text-transparent">
              KIT CURRENCY ICON LAB
            </h1>
            <p class="text-white/50 text-sm mt-1">Design playground for the flat-bottomed hexagon "Kit" (K) currency coin.</p>
          </div>
          
          <div class="flex gap-2 items-center">
            <Show when={interactiveSheen() && !gyroEnabled()}>
              <button
                onClick={requestGyroPermission}
                class="px-3 py-2 text-xs font-mono bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 hover:border-amber-500/40 rounded transition-all flex items-center gap-1 uppercase"
              >
                📱 Link Gyro (Mobile)
              </button>
            </Show>

            <button 
              onClick={() => setInteractiveSheen(!interactiveSheen())}
              class={`px-4 py-2 text-xs font-mono border rounded transition-all flex items-center gap-1.5 ${interactiveSheen() ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
            >
              <span class={`relative flex h-2 w-2 ${interactiveSheen() ? 'inline-flex' : 'hidden'}`}>
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              HOLO-REFLEX: {interactiveSheen() ? 'ON' : 'OFF'}
            </button>

            <button 
              onClick={() => window.history.back()}
              class="px-4 py-2 text-xs font-mono border border-white/10 rounded bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-white/80 shrink-0"
            >
              &larr; BACK TO NAVIGATION
            </button>
          </div>
        </header>

        {/* SECTION 1: Dynamic Vector SVG Variations */}
        <section class="mb-12">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 class="text-xl font-bold tracking-wide text-white border-l-2 border-amber-500 pl-3">
              1. Real-Time Vector SVG Renderer
            </h2>
            <div class="flex flex-wrap gap-1.5">
              <button 
                onClick={() => applyPreset('thin')}
                class="px-2 py-0.5 text-[10px] font-mono rounded bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-white/70 hover:text-amber-300"
              >
                THIN (3px)
              </button>
              <button 
                onClick={() => applyPreset('medium')}
                class="px-2 py-0.5 text-[10px] font-mono rounded bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-white/70 hover:text-amber-300"
              >
                BOLD (6px)
              </button>
              <button 
                onClick={() => applyPreset('thick')}
                class="px-2 py-0.5 text-[10px] font-mono rounded bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-white/70 hover:text-amber-300"
              >
                HEAVY (10px)
              </button>
              <button 
                onClick={() => applyPreset('triple')}
                class="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/20 transition-all text-amber-300"
              >
                ★ TRIPLE HEX (4px)
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Interactive Editor Controls */}
            <div class="lg:col-span-1 p-3.5 rounded-lg bg-white/[0.02] border border-white/10 backdrop-blur-md flex flex-col justify-between gap-4">
              <div>
                <h3 class="text-xs font-semibold tracking-wider uppercase text-white/80 mb-2.5 pb-1.5 border-b border-white/5">
                  SVG Geometry Tweaker
                </h3>

                 {/* Performance gate: hide blur / glow / texture-filter effects */}
                 <label class="mb-2.5 flex items-center gap-2 cursor-pointer select-none rounded border border-amber-500/20 bg-amber-500/[0.04] px-2 py-1.5">
                   <input
                     type="checkbox"
                     checked={heavyFx()}
                     onChange={(e) => toggleHeavyFx(e.currentTarget.checked)}
                     class="accent-amber-500 cursor-pointer"
                   />
                   <span class="text-[10px] leading-tight text-amber-200/90">
                     Enable heavy effects <span class="text-white/40">(softbox blur · glow · texture filters — laggy on phones)</span>
                   </span>
                 </label>

                 {/* Fill Mode Switcher */}
                 <div class="mb-2.5">
                   <span class="text-[10px] text-white/50 block mb-1 uppercase tracking-wider">Fill Mode</span>
                   <div class="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded border border-white/5">
                     <button 
                       onClick={() => setFillMode('gradient')}
                       class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${fillMode() === 'gradient' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                     >
                       GRADIENT
                     </button>
                     <Show when={heavyFx()}>
                       <button
                         onClick={() => setFillMode('texture')}
                         class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${fillMode() === 'texture' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                       >
                         TEXTURE FILE
                       </button>
                     </Show>
                   </div>
                 </div>

                 {/* Material Gradient Profiles or Texture Dropdown */}
                 <Show when={fillMode() === 'gradient'}>
                   <div class="mb-2.5">
                     <span class="text-[10px] text-white/50 block mb-1 uppercase tracking-wider">Material Gradient Scheme</span>
                     <select
                       value={gradientProfile()}
                       onChange={(e) => {
                         const val = e.currentTarget.value as any;
                         setGradientProfile(val);
                         if (val === 'R1' || val === 'R2') {
                           setCustomType('radial');
                         } else if (val !== 'Custom') {
                           setCustomType('linear');
                         }
                       }}
                       class="w-full bg-[#12131a] border border-white/10 rounded px-2.5 py-1.5 text-[10.5px] font-mono text-amber-300 outline-none focus:border-amber-500/50"
                     >
                       <option value="G">Opt G: Horizon Au (Reference match)</option>
                       <option value="I">Opt I: Soft Horizon Au (Subtle)</option>
                       <option value="J">Opt J: Tiling Soft Au (Seamless)</option>
                       <option value="K">Opt K: Soft Chrome II (Linear Preset)</option>
                       <option value="A">Opt A: Shiny Au</option>
                       <option value="B">Opt B: Contrast Au</option>
                       <option value="C">Opt C: Antique Au</option>
                       <option value="D">Opt D: Platinum Ag</option>
                       <option value="E">Opt E: Steel Ag</option>
                       <option value="F">Opt F: Obsidian Ag</option>
                       <option value="R1">Opt R1: Radial Chrome (Dome Reflect)</option>
                       <option value="R2">Opt R2: Radial Soft (Smooth Dome)</option>
                       <option value="Custom">Opt H: Custom (Interactive Editor)</option>
                     </select>
                   </div>

                   {/* Reflection Style Selector (Globally Visible for all profiles) */}
                   <div class="mb-3.5 border-t border-white/5 pt-2.5">
                     <div class="flex items-center justify-between">
                       <span class="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Reflection Style</span>
                       <div class="flex gap-1 bg-black/40 p-0.5 rounded border border-white/5">
                         <button 
                           type="button"
                           onClick={() => setCustomType('linear')}
                           class={`px-2 py-0.5 text-[9.5px] font-mono rounded transition-all ${customType() === 'linear' ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent hover:bg-white/5'}`}
                         >
                           Linear
                         </button>
                         <button 
                           type="button"
                           onClick={() => setCustomType('radial')}
                           class={`px-2 py-0.5 text-[9.5px] font-mono rounded transition-all ${customType() === 'radial' ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent hover:bg-white/5'}`}
                         >
                           Radial
                         </button>
                         <Show when={heavyFx()}>
                           <button
                             type="button"
                             onClick={() => setCustomType('box')}
                             class={`px-2 py-0.5 text-[9.5px] font-mono rounded transition-all ${customType() === 'box' ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent hover:bg-white/5'}`}
                           >
                             Softbox
                           </button>
                         </Show>
                       </div>
                     </div>
                   </div>
                 </Show>

                  {/* Dynamic Gradient stop editor (Opt H Custom only) */}
                  <Show when={fillMode() === 'gradient' && gradientProfile() === 'Custom' && customType() !== 'box'}>
                    <div class="mt-4 border-t border-white/10 pt-4">
                      <h4 class="text-[10.5px] font-semibold tracking-wider uppercase text-amber-400 mb-3 flex justify-between items-center">
                        <span>Gradient stop editor</span>
                        <span class="text-[9px] font-mono text-white/40 uppercase">Opt H active</span>
                      </h4>

                      {/* Visual preview (Linear Bar vs Radial Sphere) */}
                      <Show when={customType() === 'linear'}>
                        <div class="text-[9px] text-white/40 mb-1.5 font-mono uppercase tracking-wider">Linear Specular Bar</div>
                        <div 
                          style={{ background: `linear-gradient(to right, ${stopsCssString()})` }} 
                          class="w-full h-5 rounded border border-white/20 mb-3.5 shadow-inner relative"
                        />
                      </Show>
                      <Show when={customType() === 'radial'}>
                        <div class="text-[9px] text-white/40 mb-1.5 font-mono uppercase tracking-wider text-center">Concentric Rings Visualizer</div>
                        <div class="flex justify-center mb-4">
                          <div 
                            style={{ background: `radial-gradient(circle at 50% 50%, ${stopsCssString()})` }} 
                            class="w-32 h-32 rounded-full border border-white/20 shadow-2xl relative overflow-hidden transition-all duration-300"
                          >
                            {/* Inner volumetric shading layer for 3D metallic feel */}
                            <div class="absolute inset-0 bg-gradient-to-tr from-black/25 via-transparent to-white/15 pointer-events-none" />
                            
                            {/* SVG Overlay representing the stops visually */}
                            <svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full pointer-events-none">
                              {/* Center marker */}
                              <circle cx="50" cy="50" r="1.5" fill="#fff" opacity="0.8" />
                              
                              {/* Radius line */}
                              <line x1="50" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,0.4)" stroke-width="0.75" stroke-dasharray="2 1.5" />
                              
                              {/* Outer boundary ring (100%) */}
                              <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.25)" stroke-width="0.75" stroke-dasharray="1 1" fill="none" />
                              
                              {/* Concentric rings for each stop */}
                              <For each={customStops()}>
                                {(stop) => {
                                  const radius = () => stop.offset * 0.45; // map 0-100% to 0-45px radius
                                  const isHovered = () => hoveredStopId() === stop.id;
                                  return (
                                    <g>
                                      {/* Ring */}
                                      <circle 
                                        cx="50" 
                                        cy="50" 
                                        r={radius()} 
                                        stroke={isHovered() ? "#fbbf24" : "rgba(255,255,255,0.2)"} 
                                        stroke-width={isHovered() ? 1.5 : 0.5} 
                                        stroke-dasharray={isHovered() ? "3 1" : "none"} 
                                        fill="none" 
                                        class="transition-all duration-150"
                                      />
                                      {/* Stop marker on radius line */}
                                      <circle 
                                        cx={50 + stop.offset * 0.45} 
                                        cy="50" 
                                        r={isHovered() ? 4 : 2.5} 
                                        fill={stop.color} 
                                        stroke={isHovered() ? "#fbbf24" : "rgba(255,255,255,0.7)"} 
                                        stroke-width={isHovered() ? 1.5 : 0.75} 
                                        class="transition-all duration-150"
                                      />
                                    </g>
                                  );
                                }}
                              </For>
                              
                              {/* Labels */}
                              <text x="50" y="44" font-size="4.5" fill="rgba(255,255,255,0.7)" font-family="monospace" text-anchor="middle" font-weight="bold">Center (0%)</text>
                              <text x="95" y="44" font-size="4.5" fill="rgba(255,255,255,0.7)" font-family="monospace" text-anchor="end" font-weight="bold">Edge (100%)</text>
                            </svg>
                          </div>
                        </div>
                      </Show>

                      {/* Preset Template Selector */}
                      <div class="mb-3 flex items-center justify-between gap-2 bg-black/40 p-1.5 rounded border border-white/5">
                        <span class="text-[10px] text-white/50 uppercase tracking-wider">Load Preset template</span>
                        <select 
                          onChange={(e) => {
                            const val = e.currentTarget.value;
                            if (val === 'A') setCustomStops([
                              { id: 1, offset: 0, color: '#FFF3C2' },
                              { id: 2, offset: 25, color: '#E2B857' },
                              { id: 3, offset: 50, color: '#FCF6BA' },
                              { id: 4, offset: 75, color: '#B28424' },
                              { id: 5, offset: 100, color: '#FCD267' }
                            ]);
                            else if (val === 'B') setCustomStops([
                              { id: 1, offset: 0, color: '#251502' },
                              { id: 2, offset: 25, color: '#E5B842' },
                              { id: 3, offset: 50, color: '#FFF7C7' },
                              { id: 4, offset: 75, color: '#E5B842' },
                              { id: 5, offset: 100, color: '#251502' }
                            ]);
                            else if (val === 'C') setCustomStops([
                              { id: 1, offset: 0, color: '#FFF2C2' },
                              { id: 2, offset: 30, color: '#C5A44E' },
                              { id: 3, offset: 50, color: '#A48748' },
                              { id: 4, offset: 70, color: '#EDCD75' },
                              { id: 5, offset: 100, color: '#B7984A' }
                            ]);
                            else if (val === 'D') setCustomStops([
                              { id: 1, offset: 0, color: '#EBEFF5' },
                              { id: 2, offset: 25, color: '#B5B9BF' },
                              { id: 3, offset: 50, color: '#EDF1F7' },
                              { id: 4, offset: 75, color: '#83878D' },
                              { id: 5, offset: 100, color: '#CED2D8' }
                            ]);
                            else if (val === 'E') setCustomStops([
                              { id: 1, offset: 0, color: '#D1D5DB' },
                              { id: 2, offset: 30, color: '#6B7280' },
                              { id: 3, offset: 50, color: '#374151' },
                              { id: 4, offset: 70, color: '#9CA3AF' },
                              { id: 5, offset: 100, color: '#4B5563' }
                            ]);
                            else if (val === 'G') setCustomStops([
                              { id: 1, offset: 0, color: '#55411B' },
                              { id: 2, offset: 8, color: '#997E47' },
                              { id: 3, offset: 26, color: '#B8A269' },
                              { id: 4, offset: 30, color: '#55411B' },
                              { id: 5, offset: 34, color: '#FFFDDA' },
                              { id: 6, offset: 60, color: '#D5BB8A' },
                              { id: 7, offset: 81, color: '#B8A269' },
                              { id: 8, offset: 85, color: '#55411B' },
                              { id: 9, offset: 89, color: '#FBECA9' },
                              { id: 10, offset: 100, color: '#D5BB8A' }
                            ]);
                            else if (val === 'I') setCustomStops([
                              { id: 1, offset: 0, color: '#7C6535' },
                              { id: 2, offset: 8, color: '#997E47' },
                              { id: 3, offset: 26, color: '#B8A269' },
                              { id: 4, offset: 30, color: '#7C6535' },
                              { id: 5, offset: 34, color: '#FFFDDA' },
                              { id: 6, offset: 60, color: '#D5BB8A' },
                              { id: 7, offset: 81, color: '#B8A269' },
                              { id: 8, offset: 85, color: '#7C6535' },
                              { id: 9, offset: 89, color: '#FBECA9' },
                              { id: 10, offset: 100, color: '#D5BB8A' }
                            ]);
                            else if (val === 'J') setCustomStops([
                              { id: 1, offset: 0, color: '#7C6535' },
                              { id: 2, offset: 8, color: '#997E47' },
                              { id: 3, offset: 26, color: '#B8A269' },
                              { id: 4, offset: 30, color: '#7C6535' },
                              { id: 5, offset: 34, color: '#FFFDDA' },
                              { id: 6, offset: 60, color: '#D5BB8A' },
                              { id: 7, offset: 81, color: '#B8A269' },
                              { id: 8, offset: 85, color: '#7C6535' },
                              { id: 9, offset: 93, color: '#FBECA9' },
                              { id: 10, offset: 100, color: '#7C6535' }
                            ]);
                            else if (val === 'K') setCustomStops([
                              { id: 1, offset: 0, color: '#FFFDDA' },
                              { id: 2, offset: 31, color: '#D5BB8A' },
                              { id: 3, offset: 44, color: '#7C6535' },
                              { id: 4, offset: 100, color: '#55411B' }
                            ]);
                            else if (val === 'R1') setCustomStops([
                              { id: 1, offset: 0, color: '#FFFDDA' },
                              { id: 2, offset: 15, color: '#D5BB8A' },
                              { id: 3, offset: 35, color: '#7C6535' },
                              { id: 4, offset: 55, color: '#FFFDDA' },
                              { id: 5, offset: 75, color: '#D5BB8A' },
                              { id: 6, offset: 90, color: '#7C6535' },
                              { id: 7, offset: 100, color: '#55411B' }
                            ]);
                            else if (val === 'R2') setCustomStops([
                              { id: 1, offset: 0, color: '#FFFDDA' },
                              { id: 2, offset: 25, color: '#D5BB8A' },
                              { id: 3, offset: 60, color: '#7C6535' },
                              { id: 4, offset: 100, color: '#55411B' }
                            ]);
                            e.currentTarget.value = ""; // Reset
                          }}
                          class="bg-[#12131a] border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-amber-300 outline-none focus:border-amber-500/50"
                        >
                          <option value="">-- Choose Preset --</option>
                          <option value="G">Opt G: Horizon Au</option>
                          <option value="I">Opt I: Soft Horizon Au</option>
                          <option value="J">Opt J: Tiling Soft Au (Seamless)</option>
                          <option value="K">Opt K: Soft Chrome II</option>
                          <option value="R1">Opt R1: Radial Chrome</option>
                          <option value="R2">Opt R2: Radial Soft</option>
                          <option value="A">Opt A: Shiny Au</option>
                          <option value="B">Opt B: Contrast Au</option>
                          <option value="C">Opt C: Antique Au</option>
                          <option value="D">Opt D: Platinum Ag</option>
                          <option value="E">Opt E: Steel Ag</option>
                        </select>
                      </div>

                      {/* Coordinates Section */}
                      <div class="mb-4 space-y-2.5 bg-black/20 p-2 rounded border border-white/5">
                        {/* Angle Slider */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">{customType() === 'radial' ? 'Highlight Angle (Direction)' : 'Angle / Rotation'}</span>
                            <span class="font-mono text-amber-400 font-semibold">{gradientAngle()}°</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="360" 
                            value={gradientAngle()}
                            onInput={(e) => setGradientAngle(parseInt(e.currentTarget.value))}
                            class="w-full accent-amber-500 h-1 cursor-ew-resize" 
                          />
                        </div>

                        {/* Scale / Width Slider */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">{customType() === 'radial' ? 'Dome Size (Radius)' : 'Width / Scale'}</span>
                            <span class="font-mono text-amber-400 font-semibold">{Math.round(gradientScale() * 100)}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.2" 
                            max="3.0" 
                            step="0.05"
                            value={gradientScale()}
                            onInput={(e) => setGradientScale(parseFloat(e.currentTarget.value))}
                            class="w-full accent-amber-500 h-1 cursor-ew-resize" 
                          />
                        </div>

                        {/* Shift / Offset Slider */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">{customType() === 'radial' ? 'Highlight Shift (Offset)' : 'Shift / Position'}</span>
                            <span class="font-mono text-amber-400 font-semibold">{gradientShift()}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="-100" 
                            max="100" 
                            value={gradientShift()}
                            onInput={(e) => setGradientShift(parseInt(e.currentTarget.value))}
                            class="w-full accent-amber-500 h-1 cursor-ew-resize" 
                          />
                        </div>
                      </div>

                      {/* Stop Manager List */}
                      <div class="max-h-[500px] overflow-y-auto pr-1 mb-2.5 custom-scrollbar flex flex-col gap-1.5">
                        <For each={[...customStops()].sort((a, b) => a.offset - b.offset)}>
                          {(stop) => {
                            const isActive = () => activeColorPickerStopId() === stop.id;
                            return (
                              <div class="flex flex-col gap-1">
                                <div 
                                  onMouseEnter={() => setHoveredStopId(stop.id)}
                                  onMouseLeave={() => setHoveredStopId(null)}
                                  onClick={() => setActiveColorPickerStopId(isActive() ? null : stop.id)}
                                  class={`flex items-center gap-2 bg-black/40 p-1.5 rounded border transition-all justify-between cursor-pointer ${isActive() ? 'border-amber-500/50 bg-amber-500/5 shadow-inner' : (hoveredStopId() === stop.id ? 'border-amber-500/20 bg-amber-500/[0.02]' : 'border-white/5')}`}
                                >
                                  <div class="flex items-center gap-1.5 shrink-0">
                                    <div 
                                      style={{ "background-color": stop.color }}
                                      class={`w-4 h-4 rounded border shadow-sm transition-all ${isActive() ? 'border-amber-400 scale-110 shadow-amber-500/20' : 'border-white/20'}`}
                                    />
                                    <span class="text-[9.5px] font-mono text-white/50 w-8">{stop.offset}%</span>
                                  </div>
                                  <input 
                                      type="range" 
                                      min="0" 
                                      max="100" 
                                      value={stop.offset} 
                                      onInput={(e) => {
                                        const val = parseInt(e.currentTarget.value);
                                        setCustomStops(customStops().map(s => s.id === stop.id ? { ...s, offset: val } : s));
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      class="flex-1 min-w-0 accent-amber-500 h-1 cursor-ew-resize" 
                                  />
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (customStops().length > 2) {
                                        setCustomStops(customStops().filter(s => s.id !== stop.id));
                                      }
                                    }}
                                    disabled={customStops().length <= 2}
                                    class="text-red-400 hover:text-red-300 disabled:opacity-30 disabled:text-white/30 text-[10px] font-mono font-bold px-1 transition-colors hover:bg-white/5 rounded"
                                  >
                                    ✕
                                  </button>
                                </div>

                                <Show when={isActive()}>
                                  <div class="border border-amber-500/20 rounded-lg p-2.5 bg-[#12131a]/60 mt-1 mb-2 space-y-3 cursor-default" onClick={(e) => e.stopPropagation()}>
                                    <div class="flex items-center justify-between mb-2">
                                      <span class="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                                        Stop #{customStops().findIndex(s => s.id === stop.id) + 1} Picker
                                      </span>
                                      
                                      {/* Toolbar: Copy, Paste and Color Mode */}
                                      <div class="flex items-center gap-1.5">
                                        <div class="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); copyColor(); }}
                                            class="px-1.5 py-0.5 text-[8.5px] font-mono rounded bg-white/5 border border-white/10 text-white/60 hover:text-amber-300 hover:border-amber-500/30 transition-all flex items-center gap-1"
                                            title="Copy hex code to clipboard"
                                          >
                                            {colorCopiedFeedback() ? '✓' : '⎘'} Copy
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); pasteColor(); }}
                                            class="px-1.5 py-0.5 text-[8.5px] font-mono rounded bg-white/5 border border-white/10 text-white/60 hover:text-amber-300 hover:border-amber-500/30 transition-all flex items-center gap-1"
                                            title="Paste hex code from clipboard"
                                          >
                                            📋 Paste
                                          </button>
                                        </div>
                                        
                                        <div class="h-3 w-[1px] bg-white/10"></div>
                                        
                                        <div class="flex gap-1">
                                          <For each={['HSL', 'RGB', 'HEX'] as const}>
                                            {(mode) => (
                                              <button
                                                type="button"
                                                onClick={() => updateColorMode(mode)}
                                                class={`px-1.5 py-0.5 text-[8.5px] font-mono rounded transition-all ${colorMode() === mode ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                                              >
                                                {mode}
                                              </button>
                                            )}
                                          </For>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 2D Drag Pad (Saturation-Lightness square) */}
                                    <div 
                                      onMouseDown={handlePadMouseDown}
                                      style={{
                                        background: `linear-gradient(to top, #000 0%, transparent 50%, #fff 100%), linear-gradient(to right, #808080 0%, transparent 100%), hsl(${pickerH()}, 100%, 50%)`
                                      }}
                                      class="w-full h-28 rounded-lg relative overflow-hidden cursor-crosshair border border-white/15 mb-2.5 shadow-inner"
                                    >
                                      {/* Volumetric shadow overlay to look premium */}
                                      <div class="absolute inset-0 bg-gradient-to-tr from-black/25 via-transparent to-white/15 pointer-events-none" />
                                      
                                      {/* Draggable indicator dot */}
                                      <div 
                                        style={{
                                          left: `${pickerS()}%`,
                                          bottom: `${pickerL()}%`,
                                          "background-color": hslToHex(pickerH(), pickerS(), pickerL())
                                        }}
                                        class="w-3.5 h-3.5 rounded-full absolute -translate-x-1/2 translate-y-1/2 border-2 border-white shadow-lg pointer-events-none cursor-pointer"
                                      />
                                    </div>

                                    {/* 1. Hue Slider */}
                                    <div class="mb-3">
                                      <div class="flex justify-between text-[9px] text-white/50 mb-1 font-mono uppercase">
                                        <span>Hue (Color Tone)</span>
                                        <span class="text-amber-400 font-semibold">{pickerH()}°</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="0" 
                                        max="360" 
                                        value={pickerH()} 
                                        onInput={(e) => handleHslChange(parseInt(e.currentTarget.value), pickerS(), pickerL())}
                                        class="w-full h-2.5 rounded-lg appearance-none cursor-pointer outline-none border border-white/10 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/20 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0" 
                                        style={{
                                          background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                                          "-webkit-appearance": "none"
                                        }}
                                      />
                                    </div>

                                    {/* Mode-specific Sliders / Inputs */}
                                    <Show when={colorMode() === 'HSL'}>
                                      <div class="space-y-2">
                                        {/* Saturation */}
                                        <div>
                                          <div class="flex justify-between text-[9px] text-white/50 mb-0.5 font-mono uppercase">
                                            <span>Saturation (Intensity)</span>
                                            <span class="text-amber-400 font-semibold">{pickerS()}%</span>
                                          </div>
                                          <input 
                                            type="range" 
                                            min="0" 
                                            max="100" 
                                            value={pickerS()} 
                                            onInput={(e) => handleHslChange(pickerH(), parseInt(e.currentTarget.value), pickerL())}
                                            class="w-full accent-amber-500 h-1 cursor-ew-resize"
                                          />
                                        </div>
                                        {/* Lightness */}
                                        <div>
                                          <div class="flex justify-between text-[9px] text-white/50 mb-0.5 font-mono uppercase">
                                            <span>Lightness (Brightness)</span>
                                            <span class="text-amber-400 font-semibold">{pickerL()}%</span>
                                          </div>
                                          <input 
                                            type="range" 
                                            min="0" 
                                            max="100" 
                                            value={pickerL()} 
                                            onInput={(e) => handleHslChange(pickerH(), pickerS(), parseInt(e.currentTarget.value))}
                                            class="w-full accent-amber-500 h-1 cursor-ew-resize"
                                          />
                                        </div>
                                      </div>
                                    </Show>

                                    <Show when={colorMode() === 'RGB'}>
                                      <div class="space-y-2">
                                        {/* Red */}
                                        <div>
                                          <div class="flex justify-between text-[9px] text-white/50 mb-0.5 font-mono uppercase">
                                            <span>Red</span>
                                            <span class="text-red-400 font-semibold">{pickerR()}</span>
                                          </div>
                                          <input 
                                            type="range" 
                                            min="0" 
                                            max="255" 
                                            value={pickerR()} 
                                            onInput={(e) => handleRgbChange(parseInt(e.currentTarget.value), pickerG(), pickerB())}
                                            class="w-full accent-red-500 h-1 cursor-ew-resize"
                                          />
                                        </div>
                                        {/* Green */}
                                        <div>
                                          <div class="flex justify-between text-[9px] text-white/50 mb-0.5 font-mono uppercase">
                                            <span>Green</span>
                                            <span class="text-green-400 font-semibold">{pickerG()}</span>
                                          </div>
                                          <input 
                                            type="range" 
                                            min="0" 
                                            max="255" 
                                            value={pickerG()} 
                                            onInput={(e) => handleRgbChange(pickerR(), parseInt(e.currentTarget.value), pickerB())}
                                            class="w-full accent-green-500 h-1 cursor-ew-resize"
                                          />
                                        </div>
                                        {/* Blue */}
                                        <div>
                                          <div class="flex justify-between text-[9px] text-white/50 mb-0.5 font-mono uppercase">
                                            <span>Blue</span>
                                            <span class="text-blue-400 font-semibold">{pickerB()}</span>
                                          </div>
                                          <input 
                                            type="range" 
                                            min="0" 
                                            max="255" 
                                            value={pickerB()} 
                                            onInput={(e) => handleRgbChange(pickerR(), pickerG(), parseInt(e.currentTarget.value))}
                                            class="w-full accent-blue-500 h-1 cursor-ew-resize"
                                          />
                                        </div>
                                      </div>
                                    </Show>

                                    <Show when={colorMode() === 'HEX'}>
                                      <div class="flex items-center gap-2">
                                        <span class="text-[9.5px] font-mono text-white/50 uppercase">HEX Code:</span>
                                        <input 
                                          type="text"
                                          value={pickerHex()}
                                          onInput={(e) => handleHexChange(e.currentTarget.value)}
                                          class="bg-[#12131a] border border-white/10 rounded px-2 py-0.5 text-[10.5px] font-mono text-amber-300 outline-none focus:border-amber-500/50 flex-1"
                                          placeholder="#FFFFFF"
                                        />
                                        <div 
                                          style={{ "background-color": pickerHex() }} 
                                          class="w-5 h-5 rounded border border-white/20 shadow-md shrink-0"
                                        />
                                      </div>
                                    </Show>
                                  </div>
                                </Show>
                              </div>
                            );
                          }}
                        </For>
                      </div>

                      <button 
                        onClick={() => {
                          const nextId = customStops().reduce((max, s) => Math.max(max, s.id), 0) + 1;
                          setCustomStops([...customStops(), { id: nextId, offset: 50, color: '#D5BB8A' }]);
                        }}
                        class="w-full py-1 text-[9.5px] font-mono text-amber-300 hover:text-amber-200 border border-dashed border-amber-500/30 hover:border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 rounded transition-all uppercase tracking-wider mb-3"
                      >
                        ＋ Add Gradient Stop
                      </button>
                    </div>
                  </Show>

                  {/* Softbox Reflection Editor Panel (Visible whenever Softbox style is active) */}
                  <Show when={fillMode() === 'gradient' && customType() === 'box'}>
                    <div class="mt-4 border-t border-white/10 pt-4">
                      <h4 class="text-[10.5px] font-semibold tracking-wider uppercase text-amber-400 mb-3 flex justify-between items-center">
                        <span>Softbox Reflection Editor</span>
                        <span class="text-[9px] font-mono text-white/40 uppercase">Softbox active</span>
                      </h4>

                      {/* Softbox Presets Dropdown */}
                      <div class="mb-3.5 flex items-center justify-between gap-2 bg-[#0b0c10] p-1.5 rounded border border-white/5">
                        <span class="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Load Softbox Preset</span>
                        <select 
                          onChange={(e) => {
                            const presetName = e.currentTarget.value;
                            if (presetName && SOFTBOX_PRESETS[presetName]) {
                              const p = SOFTBOX_PRESETS[presetName];
                              setBoxWidth(p.width);
                              setBoxHeight(p.height);
                              setBoxBlur(p.blur);
                              setBoxCornerRadius(p.cornerRadius);
                              setBoxOpacity(p.opacity);
                              setBoxColor(p.color);
                              setBoxMixBlendMode(p.mixBlendMode);
                            }
                          }}
                          class="bg-[#12131a] border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-amber-300 outline-none focus:border-amber-500/50"
                        >
                          <option value="">-- Select Preset --</option>
                          <option value="classic">Classic Softbox</option>
                          <option value="vertical">Vertical Stripbox</option>
                          <option value="horizontal">Horizontal Skylight</option>
                          <option value="ring">Overhead Ring Light</option>
                          <option value="diffuse">Diffuse Panel</option>
                          <option value="spot">Spot Highlight</option>
                        </select>
                      </div>

                      {/* Softbox Light Source Visualizer */}
                      <div class="text-[9px] text-white/40 mb-1.5 font-mono uppercase tracking-wider text-center">Softbox Light Source Visualizer</div>
                      <div class="flex justify-center mb-4">
                        <div 
                          class="w-32 h-32 rounded bg-[#0b0c10] border border-white/20 shadow-2xl relative overflow-hidden transition-all duration-300"
                        >
                          {/* Static base metal background gradient visual */}
                          <div 
                            class="absolute inset-0 opacity-40" 
                            style={{ background: `linear-gradient(135deg, ${stopsCssString()})` }} 
                          />
                          
                          {/* Sliding Blurred Softbox Visual */}
                          <div 
                            style={{
                              width: `${boxWidth()}%`,
                              height: `${boxHeight()}%`,
                              "background-color": boxColor(),
                              "border-radius": `${boxCornerRadius()}%`,
                              opacity: boxOpacity(),
                              filter: `blur(${boxBlur() / 2}px)`,
                              transform: `translate(calc(-50% + ${interactiveShiftX()}px), calc(-50% + ${interactiveShiftY()}px))`,
                              "mix-blend-mode": boxMixBlendMode() as any,
                            }}
                            class="absolute top-1/2 left-1/2 pointer-events-none transition-transform duration-75"
                          />
                        </div>
                      </div>

                      <div class="mb-4 space-y-2.5 bg-black/20 p-2 rounded border border-white/5">
                        {/* Softbox Width Slider */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">Softbox Width</span>
                            <span class="font-mono text-amber-400 font-semibold">{boxWidth()}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="10" 
                            max="90" 
                            value={boxWidth()}
                            onInput={(e) => setBoxWidth(parseInt(e.currentTarget.value))}
                            class="w-full accent-amber-500 h-1 cursor-ew-resize" 
                          />
                        </div>

                        {/* Softbox Height Slider */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">Softbox Height</span>
                            <span class="font-mono text-amber-400 font-semibold">{boxHeight()}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="10" 
                            max="90" 
                            value={boxHeight()}
                            onInput={(e) => setBoxHeight(parseInt(e.currentTarget.value))}
                            class="w-full accent-amber-500 h-1 cursor-ew-resize" 
                          />
                        </div>

                        {/* Softbox Blur Slider */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">Edge Softness / Blur</span>
                            <span class="font-mono text-amber-400 font-semibold">{boxBlur()}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="30" 
                            value={boxBlur()}
                            onInput={(e) => setBoxBlur(parseInt(e.currentTarget.value))}
                            class="w-full accent-amber-500 h-1 cursor-ew-resize" 
                          />
                        </div>

                        {/* Softbox Corner Radius Slider */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">Corner Rounding</span>
                            <span class="font-mono text-amber-400 font-semibold">{boxCornerRadius()}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="40" 
                            value={boxCornerRadius()}
                            onInput={(e) => setBoxCornerRadius(parseInt(e.currentTarget.value))}
                            class="w-full accent-amber-500 h-1 cursor-ew-resize" 
                          />
                        </div>

                        {/* Softbox Opacity Slider */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">Reflection Opacity</span>
                            <span class="font-mono text-amber-400 font-semibold">{Math.round(boxOpacity() * 100)}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.05" 
                            max="1.0" 
                            step="0.05"
                            value={boxOpacity()}
                            onInput={(e) => setBoxOpacity(parseFloat(e.currentTarget.value))}
                            class="w-full accent-amber-500 h-1 cursor-ew-resize" 
                          />
                        </div>

                        {/* Softbox Mix Blend Mode Select */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">Mix Blend Mode</span>
                            <span class="font-mono text-amber-400 font-semibold">{boxMixBlendMode()}</span>
                          </div>
                          <select
                            value={boxMixBlendMode()}
                            onChange={(e) => setBoxMixBlendMode(e.currentTarget.value as any)}
                            class="w-full bg-[#12131a] border border-white/10 rounded px-2.5 py-1 text-[10.5px] font-mono text-amber-300 outline-none focus:border-amber-500/50"
                          >
                            <option value="color-dodge">Color Dodge (Glossy glow)</option>
                            <option value="screen">Screen (Bright light)</option>
                            <option value="overlay">Overlay (Color tint)</option>
                            <option value="normal">Normal (Solid white)</option>
                          </select>
                        </div>

                        {/* Softbox Color Select */}
                        <div>
                          <div class="flex justify-between text-[11px] mb-0.5">
                            <span class="text-white/60">Softbox Specular Color</span>
                            <span class="font-mono text-amber-400 font-semibold">{boxColor()}</span>
                          </div>
                          <div class="flex gap-2 items-center mt-1">
                            <input 
                              type="color" 
                              value={boxColor()}
                              onInput={(e) => setBoxColor(e.currentTarget.value)}
                              class="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                            />
                            <input 
                              type="text"
                              value={boxColor()}
                              onInput={(e) => setBoxColor(e.currentTarget.value)}
                              class="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10.5px] text-white font-mono outline-none flex-1 focus:border-amber-500/30"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Show>

                 <Show when={fillMode() === 'texture'}>
                    <div class="mb-2.5">
                      <span class="text-[10px] text-white/50 block mb-1 uppercase tracking-wider">Active Texture File</span>
                      <select
                        value={selectedTexture()}
                        onChange={(e) => setSelectedTexture(e.currentTarget.value)}
                        class="w-full bg-[#12131a] border border-white/10 rounded px-2 py-1 text-[10.5px] font-mono text-amber-300 outline-none focus:border-amber-500/50"
                      >
                        <For each={textureFiles}>
                          {(file) => (
                            <option value={file} class="bg-[#12131a] text-white/80">{file}</option>
                          )}
                        </For>
                      </select>
                    </div>

                    {/* Texture Scale Slider */}
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-0.5">
                        <span class="text-white/60">Texture Scale</span>
                        <span class="font-mono text-amber-400 font-semibold">{(textureScale() * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.2" 
                        max="3.0" 
                        step="0.05"
                        value={textureScale()}
                        onInput={(e) => setTextureScale(parseFloat(e.currentTarget.value))}
                        class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                      />
                    </div>

                    {/* Texture Brightness Slider */}
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-0.5">
                        <span class="text-white/60">Texture Brightness</span>
                        <span class="font-mono text-amber-400 font-semibold">{(textureBrightness() * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2.5" 
                        step="0.05"
                        value={textureBrightness()}
                        onInput={(e) => setTextureBrightness(parseFloat(e.currentTarget.value))}
                        class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                      />
                    </div>

                    {/* Texture Shift X Slider */}
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-0.5">
                        <span class="text-white/60">Texture Shift X</span>
                        <span class="font-mono text-amber-400 font-semibold">{textureOffsetX()}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="-100" 
                        max="100" 
                        step="1"
                        value={textureOffsetX()}
                        onInput={(e) => setTextureOffsetX(parseInt(e.currentTarget.value))}
                        class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                      />
                    </div>

                    {/* Texture Shift Y Slider */}
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-0.5">
                        <span class="text-white/60">Texture Shift Y</span>
                        <span class="font-mono text-amber-400 font-semibold">{textureOffsetY()}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="-100" 
                        max="100" 
                        step="1"
                        value={textureOffsetY()}
                        onInput={(e) => setTextureOffsetY(parseInt(e.currentTarget.value))}
                        class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                      />
                    </div>

                    {/* Texture Contrast Slider */}
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-0.5">
                        <span class="text-white/60">Texture Contrast</span>
                        <span class="font-mono text-amber-400 font-semibold">{(textureContrast() * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2.5" 
                        step="0.05"
                        value={textureContrast()}
                        onInput={(e) => setTextureContrast(parseFloat(e.currentTarget.value))}
                        class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                      />
                    </div>

                    {/* Texture Saturation Slider */}
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-0.5">
                        <span class="text-white/60">Texture Saturation</span>
                        <span class="font-mono text-amber-400 font-semibold">{(textureSaturation() * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.0" 
                        max="2.0" 
                        step="0.05"
                        value={textureSaturation()}
                        onInput={(e) => setTextureSaturation(parseFloat(e.currentTarget.value))}
                        class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                      />
                    </div>

                    {/* Overlay Gradient Opacity Slider */}
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-0.5">
                        <span class="text-white/60">Overlay Gradient Opacity</span>
                        <span class="font-mono text-amber-400 font-semibold">{(overlayOpacity() * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.0" 
                        max="1.0" 
                        step="0.05"
                        value={overlayOpacity()}
                        onInput={(e) => setOverlayOpacity(parseFloat(e.currentTarget.value))}
                        class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                      />
                    </div>

                    {/* Overlay Gradient Blend Mode Selector */}
                    <div class="mb-2.5">
                      <span class="text-[10px] text-white/50 block mb-1 uppercase tracking-wider font-mono">Overlay Blend Mode</span>
                      <select
                        value={overlayBlendMode()}
                        onChange={(e) => setOverlayBlendMode(e.currentTarget.value as any)}
                        class="w-full bg-[#12131a] border border-white/10 rounded px-2 py-1 text-[10.5px] font-mono text-amber-300 outline-none focus:border-amber-500/50"
                      >
                        <option value="overlay" class="bg-[#12131a] text-white/80">overlay</option>
                        <option value="color-dodge" class="bg-[#12131a] text-white/80">color-dodge</option>
                        <option value="soft-light" class="bg-[#12131a] text-white/80">soft-light</option>
                        <option value="multiply" class="bg-[#12131a] text-white/80">multiply</option>
                        <option value="screen" class="bg-[#12131a] text-white/80">screen</option>
                      </select>
                    </div>
                  </Show>

                {/* Stroke Cap Style Toggle */}
                 <div class="mb-2.5">
                   <span class="text-[10px] text-white/50 block mb-1 uppercase tracking-wider">K Stroke Cap Edges</span>
                   <div class="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded border border-white/5">
                     <button 
                       onClick={() => setLinecap('butt')}
                       class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${linecap() === 'butt' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                     >
                       SHARP
                     </button>
                     <button 
                       onClick={() => setLinecap('round')}
                       class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${linecap() === 'round' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                     >
                       ROUNDED
                     </button>
                   </div>
                 </div>
 
                 {/* K Block Mode Toggle */}
                 <div class="mb-2.5">
                   <span class="text-[10px] text-white/50 block mb-1 uppercase tracking-wider">K Rendering Mode</span>
                   <div class="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded border border-white/5">
                     <button 
                       onClick={() => {
                         setKBlockMode(false);
                         setKThickness(6.5);
                       }}
                       class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${!kBlockMode() ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                     >
                       LINE/STROKE
                     </button>
                     <button 
                       onClick={() => {
                         setKBlockMode(true);
                         setLinecap('butt'); // Enforce sharp caps for block mode
                         if (kThickness() < 12) setKThickness(16); // Set a good default block thickness
                       }}
                       class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${kBlockMode() ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                     >
                       BLOCK MODE
                     </button>
                   </div>
                 </div>

                 {/* Hexagon Border Rings Selector */}
                 <div class="mb-2.5">
                   <span class="text-[10px] text-white/50 block mb-1 uppercase tracking-wider">Hexagon Border Count</span>
                   <div class="grid grid-cols-3 gap-1 bg-black/40 p-0.5 rounded border border-white/5">
                     <button 
                       onClick={() => setRings(1)}
                       class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${rings() === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                     >
                       1 RING
                     </button>
                     <button 
                       onClick={() => setRings(2)}
                       class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${rings() === 2 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                     >
                       2 RINGS
                     </button>
                     <button 
                       onClick={() => setRings(3)}
                       class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${rings() === 3 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                     >
                       3 RINGS
                     </button>
                   </div>
                 </div>

                {/* K Scale Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Letter K Size / Scale</span>
                    <span class="font-mono text-amber-400 font-semibold">{(kScale() * 100).toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.05"
                    value={kScale()}
                    onInput={(e) => setKScale(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Nudge K Left/Right Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Nudge K Left/Right</span>
                    <span class="font-mono text-amber-400 font-semibold">{kOffsetX() > 0 ? `+` : ``}{kOffsetX()}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="-15" 
                    max="15" 
                    step="0.5"
                    value={kOffsetX()}
                    onInput={(e) => setKOffsetX(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Nudge K Up/Down Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Nudge K Up/Down</span>
                    <span class="font-mono text-amber-400 font-semibold">{kOffsetY() > 0 ? `+` : ``}{kOffsetY()}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="-15" 
                    max="15" 
                    step="0.5"
                    value={kOffsetY()}
                    onInput={(e) => setKOffsetY(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Arm Span Width (Anchor X) Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Arm Span Width</span>
                    <span class="font-mono text-amber-400 font-semibold">{kDiagWidth()}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="35" 
                    step="0.5"
                    value={kDiagWidth()}
                    onInput={(e) => setKDiagWidth(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Lower K Arm X Start Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Lower Arm X-Connection</span>
                    <span class="font-mono text-amber-400 font-semibold">{kDiag2X() > 0 ? `+` : ``}{kDiag2X()}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="-12" 
                    max="12" 
                    step="0.5"
                    value={kDiag2X()}
                    onInput={(e) => setKDiag2X(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Upper Arm Angle Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Upper Arm Angle (Spread)</span>
                    <span class="font-mono text-amber-400 font-semibold">{kDiag1Slope().toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.4" 
                    max="2.2" 
                    step="0.02"
                    value={kDiag1Slope()}
                    onInput={(e) => setKDiag1Slope(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Lower Arm Angle Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Lower Arm Angle (Spread)</span>
                    <span class="font-mono text-amber-400 font-semibold">{kDiag2Slope().toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.3" 
                    max="2.0" 
                    step="0.02"
                    value={kDiag2Slope()}
                    onInput={(e) => setKDiag2Slope(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* K Thickness Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Letter K Thickness</span>
                    <span class="font-mono text-amber-400 font-semibold">{kThickness()}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="24" 
                    step="0.5"
                    value={kThickness()}
                    onInput={(e) => setKThickness(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Ring Gap/Spacing Slider */}
                <Show when={rings() > 1}>
                  <div class="mb-2.5">
                    <div class="flex justify-between text-[11px] mb-0.5">
                      <span class="text-white/60">Ring Spacing (Gap)</span>
                      <span class="font-mono text-amber-400 font-semibold">{ringGap()}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="2" 
                      max="16" 
                      step="0.5"
                      value={ringGap()}
                      onInput={(e) => setRingGap(parseFloat(e.currentTarget.value))}
                      class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                    />
                  </div>
                </Show>

                {/* Border Thickness Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Border Thickness</span>
                    <span class="font-mono text-amber-400 font-semibold">{thickness()}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="24" 
                    step="0.5"
                    value={thickness()}
                    onInput={(e) => setThickness(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Bevel Offset Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">3D Bevel Offset</span>
                    <span class="font-mono text-amber-400 font-semibold">{bevelOffset()}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="3" 
                    step="0.1"
                    value={bevelOffset()}
                    onInput={(e) => setBevelOffset(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Bevel Opacity Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">3D Bevel Opacity</span>
                    <span class="font-mono text-amber-400 font-semibold">{(bevelOpacity() * 100).toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={bevelOpacity()}
                    onInput={(e) => setBevelOpacity(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Fill Opacity Slider */}
                <div class="mb-2.5">
                  <div class="flex justify-between text-[11px] mb-0.5">
                    <span class="text-white/60">Inner Hex Fill Opacity</span>
                    <span class="font-mono text-amber-400 font-semibold">{(hexFillOpacity() * 100).toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="0.4" 
                    step="0.01"
                    value={hexFillOpacity()}
                    onInput={(e) => setHexFillOpacity(parseFloat(e.currentTarget.value))}
                    class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                  />
                </div>

                {/* Glow Intensity Slider — drop-shadow filter, perf-gated */}
                <Show when={heavyFx()}>
                  <div class="mb-1">
                    <div class="flex justify-between text-[11px] mb-0.5">
                      <span class="text-white/60">Specular Glow Blur</span>
                      <span class="font-mono text-amber-400 font-semibold">{glowIntensity()}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={glowIntensity()}
                      onInput={(e) => setGlowIntensity(parseInt(e.currentTarget.value))}
                      class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </Show>
              </div>

              <div class="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded text-[10px] text-amber-300/80 leading-snug space-y-0.5">
                <p><strong>Independent Thickness:</strong> Border & K can be scaled separately. Slanted path shearing cuts adjust to K's thickness dynamically.</p>
                <p><strong>Clipped flat:</strong> Diagonals are chopped flat at stem top/bottom bounds.</p>
              </div>
            </div>

            {/* SVG Visualizers */}
            <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Presets Visual Representation */}
              <For each={['thin', 'medium', 'thick'] as const}>
                {(type) => {
                  const uniqueId = `card-${type}`;

                  // Global reflex from the single pointer source — same path as
                  // KanIcon, no rect reads, no hover swap, no damping.
                  const cardReflex = createReflexShift();
                  const activeCardShiftX = () => cardReflex().nx * REFLEX_SVG_UNITS;
                  const activeCardShiftY = () => cardReflex().ny * REFLEX_SVG_UNITS;

                  const cardCoords = () => gradCoords(activeCardShiftX(), activeCardShiftY());
                  const cardRadialCoords = () => radialCoords(activeCardShiftX(), activeCardShiftY());

                  const cardCoordsStatic = () => gradCoords(0, 0);
                  const cardRadialCoordsStatic = () => radialCoords(0, 0);

                  const borderStrokeWidth = () => {
                    const base = thickness();
                    if (type === 'thin') return Math.max(1, base - 3);
                    if (type === 'thick') return base + 4;
                    return base;
                  };

                  const currentKStrokeWidth = () => {
                    const base = kThickness();
                    if (type === 'thin') return Math.max(1, base - 3);
                    if (type === 'thick') return base + 4;
                    return base;
                  };

                  const c = () => getKCoords(kScale(), currentKStrokeWidth(), linecap());
                  const renderSizeCell = (size: string, px: string) => {
                    const isOptical = ['1rem', '1.5rem', '2rem', '2.5rem'].includes(size);
                    // Live gradients (mouse-driven) so every size cell reacts,
                    // not just the main coin.
                    const sizeColor = () => {
                      if (fillMode() === 'gradient') {
                        return isOptical
                          ? `url(#gold-grad-optical-${type})`
                          : `url(#gold-grad-${type})`;
                      } else {
                        return `url(#gold-pattern-${type})`;
                      }
                    };
                    const sizeGradientColor = () => isOptical
                      ? `url(#gold-grad-optical-${type})`
                      : `url(#gold-grad-${type})`;

                    return (
                      <div class="group/size relative flex flex-col items-center justify-end cursor-help pb-0.5">
                        <div class="bg-black/60 border border-white/5 hover:border-amber-500/40 hover:bg-black/80 rounded flex items-center justify-center overflow-hidden transition-all shadow-inner" style={{ width: `calc(${size} + 6px)`, height: `calc(${size} + 6px)` }}>
                           <svg viewBox="0 0 100 100" style={{ width: size, height: size, ...(glowIntensity() > 0 ? { filter: `drop-shadow(0 0 ${glowIntensity()}px rgba(251, 191, 36, 0.45))` } : {}) }}>
                             {/* Hexagon Shadow Outline */}
                             <For each={Array.from({ length: rings() }, (_, i) => i)}>
                               {(index) => (
                                 <polygon 
                                   points={getHexagonPoints(index, borderStrokeWidth())} 
                                   fill={index === 0 ? sizeColor() : 'none'} 
                                   fill-opacity={index === 0 ? hexFillOpacity() : 0}
                                   stroke="#201A0A" 
                                   stroke-width={borderStrokeWidth() + bevelOffset() * 1.5}
                                   stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                   transform={`translate(${bevelOffset()}, ${bevelOffset()})`}
                                 />
                               )}
                             </For>
                             {/* Hexagon Highlight Outline */}
                             <For each={Array.from({ length: rings() }, (_, i) => i)}>
                               {(index) => (
                                 <polygon 
                                   points={getHexagonPoints(index, borderStrokeWidth())} 
                                   fill="none" 
                                   stroke="#FFFDDA" 
                                   stroke-width={borderStrokeWidth() + bevelOffset() * 0.5}
                                   stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                   transform={`translate(${-bevelOffset()}, ${-bevelOffset()})`}
                                   opacity={bevelOpacity()}
                                 />
                               )}
                             </For>
                             {/* Hexagon Main Face */}
                             <For each={Array.from({ length: rings() }, (_, i) => i)}>
                               {(index) => (
                                 <polygon 
                                   points={getHexagonPoints(index, borderStrokeWidth())} 
                                   fill={index === 0 ? sizeColor() : 'none'} 
                                   fill-opacity={index === 0 ? hexFillOpacity() : 0}
                                   stroke={sizeColor()} 
                                   stroke-width={borderStrokeWidth()}
                                   stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                 />
                               )}
                             </For>
                             
                             {/* Hexagon Softbox Specular Overlay */}
                             <Show when={fillMode() === 'gradient' && customType() === 'box'}>
                               <For each={Array.from({ length: rings() }, (_, i) => i)}>
                                 {(index) => (
                                   <polygon 
                                     points={getHexagonPoints(index, borderStrokeWidth())} 
                                     fill={index === 0 ? (isOptical ? `url(#gold-box-pattern-optical-static-${type})` : `url(#gold-box-pattern-static-${type})`) : 'none'} 
                                     fill-opacity={index === 0 ? hexFillOpacity() : 0}
                                     stroke={isOptical ? `url(#gold-box-pattern-optical-static-${type})` : `url(#gold-box-pattern-static-${type})`} 
                                     stroke-width={borderStrokeWidth()}
                                     stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                     style={{
                                       "mix-blend-mode": boxMixBlendMode(),
                                       "pointer-events": "none"
                                     }}
                                   />
                                 )}
                               </For>
                             </Show>

                             <Show when={fillMode() === 'texture' && overlayOpacity() > 0}>
                               <For each={Array.from({ length: rings() }, (_, i) => i)}>
                                 {(index) => (
                                   <polygon 
                                     points={getHexagonPoints(index, borderStrokeWidth())} 
                                     fill={index === 0 ? sizeGradientColor() : 'none'} 
                                     fill-opacity={index === 0 ? hexFillOpacity() : 0}
                                     stroke={sizeGradientColor()} 
                                     stroke-width={borderStrokeWidth()}
                                     stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                     style={{
                                       "mix-blend-mode": overlayBlendMode(),
                                       opacity: overlayOpacity(),
                                       "pointer-events": "none"
                                     }}
                                   />
                                 )}
                               </For>
                             </Show>

                             {/* 1. K SHADOWS */}
                             <path 
                               d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                               fill="none"
                               stroke="#201A0A"
                               stroke-width={currentKStrokeWidth() + bevelOffset() * 1.5}
                               stroke-linecap={linecap()}
                               transform={`translate(${bevelOffset()}, ${bevelOffset()})`}
                              />
                             <g clip-path={`url(#k-horizontal-clip-${type})`}>
                               <path 
                                 d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                 fill="none"
                                 stroke="#201A0A"
                                 stroke-width={currentKStrokeWidth() + bevelOffset() * 1.5}
                                 stroke-linecap={linecap()}
                                 stroke-linejoin="miter"
                                 transform={`translate(${bevelOffset()}, ${bevelOffset()})`}
                               />
                               <path 
                                 d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                 fill="none"
                                 stroke="#201A0A"
                                 stroke-width={currentKStrokeWidth() + bevelOffset() * 1.5}
                                 stroke-linecap={linecap()}
                                 stroke-linejoin="miter"
                                 transform={`translate(${bevelOffset()}, ${bevelOffset()})`}
                               />
                             </g>

                             {/* 2. K HIGHLIGHTS */}
                             <path 
                               d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                               fill="none"
                               stroke="#FFFDDA"
                               stroke-width={currentKStrokeWidth() + bevelOffset() * 0.5}
                               stroke-linecap={linecap()}
                               transform={`translate(${-bevelOffset()}, ${-bevelOffset()})`}
                               opacity={bevelOpacity()}
                             />
                             <g clip-path={`url(#k-horizontal-clip-${type})`}>
                               <path 
                                 d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                 fill="none"
                                 stroke="#FFFDDA"
                                 stroke-width={currentKStrokeWidth() + bevelOffset() * 0.5}
                                 stroke-linecap={linecap()}
                                 stroke-linejoin="miter"
                                 transform={`translate(${-bevelOffset()}, ${-bevelOffset()})`}
                                 opacity={bevelOpacity()}
                               />
                               <path 
                                 d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                 fill="none"
                                 stroke="#FFFDDA"
                                 stroke-width={currentKStrokeWidth() + bevelOffset() * 0.5}
                                 stroke-linecap={linecap()}
                                 stroke-linejoin="miter"
                                 transform={`translate(${-bevelOffset()}, ${-bevelOffset()})`}
                                 opacity={bevelOpacity()}
                               />
                             </g>

                             {/* 3. K MAINS */}
                             <path 
                               d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                               fill="none"
                               stroke={sizeColor()}
                               stroke-width={currentKStrokeWidth()}
                               stroke-linecap={linecap()}
                             />
                             <g clip-path={`url(#k-horizontal-clip-${type})`}>
                               <path 
                                 d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                 fill="none"
                                 stroke={sizeColor()}
                                 stroke-width={currentKStrokeWidth()}
                                 stroke-linecap={linecap()}
                                 stroke-linejoin="miter"
                               />
                               <path 
                                 d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                 fill="none"
                                 stroke={sizeColor()}
                                 stroke-width={currentKStrokeWidth()}
                                 stroke-linecap={linecap()}
                                 stroke-linejoin="miter"
                               />
                             </g>

                             {/* 4. K TEXTURE OVERLAYS */}
                             <Show when={fillMode() === 'texture' && overlayOpacity() > 0}>
                               <path 
                                 d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                                 fill="none"
                                 stroke={sizeGradientColor()}
                                 stroke-width={currentKStrokeWidth()}
                                 stroke-linecap={linecap()}
                                 style={{
                                   "mix-blend-mode": overlayBlendMode(),
                                   opacity: overlayOpacity(),
                                   "pointer-events": "none"
                                 }}
                               />
                               <g clip-path={`url(#k-horizontal-clip-${type})`}>
                                 <path 
                                   d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                   fill="none"
                                   stroke={sizeGradientColor()}
                                   stroke-width={currentKStrokeWidth()}
                                   stroke-linecap={linecap()}
                                   stroke-linejoin="miter"
                                   style={{
                                     "mix-blend-mode": overlayBlendMode(),
                                     opacity: overlayOpacity(),
                                     "pointer-events": "none"
                                   }}
                                 />
                                 <path 
                                   d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                   fill="none"
                                   stroke={sizeGradientColor()}
                                   stroke-width={currentKStrokeWidth()}
                                   stroke-linecap={linecap()}
                                   stroke-linejoin="miter"
                                   style={{
                                     "mix-blend-mode": overlayBlendMode(),
                                     opacity: overlayOpacity(),
                                     "pointer-events": "none"
                                   }}
                                 />
                               </g>
                             </Show>

                             {/* 4.5. K Softbox Specular Overlay */}
                             <Show when={fillMode() === 'gradient' && customType() === 'box'}>
                               <path 
                                 d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                                 fill="none"
                                 stroke={isOptical ? `url(#gold-box-pattern-optical-static-${type})` : `url(#gold-box-pattern-static-${type})`}
                                 stroke-width={currentKStrokeWidth()}
                                 stroke-linecap={linecap()}
                                 style={{
                                   "mix-blend-mode": boxMixBlendMode(),
                                   "pointer-events": "none"
                                 }}
                               />
                               <g clip-path={`url(#k-horizontal-clip-${type})`}>
                                 <path 
                                   d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                   fill="none"
                                   stroke={isOptical ? `url(#gold-box-pattern-optical-static-${type})` : `url(#gold-box-pattern-static-${type})`}
                                   stroke-width={currentKStrokeWidth()}
                                   stroke-linecap={linecap()}
                                   stroke-linejoin="miter"
                                   style={{
                                     "mix-blend-mode": boxMixBlendMode(),
                                     "pointer-events": "none"
                                   }}
                                 />
                                 <path 
                                   d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                   fill="none"
                                   stroke={isOptical ? `url(#gold-box-pattern-optical-static-${type})` : `url(#gold-box-pattern-static-${type})`}
                                   stroke-width={currentKStrokeWidth()}
                                   stroke-linecap={linecap()}
                                   stroke-linejoin="miter"
                                   style={{
                                     "mix-blend-mode": boxMixBlendMode(),
                                     "pointer-events": "none"
                                   }}
                                 />
                               </g>
                             </Show>
                           </svg>
                         </div>
                         <span class="text-[7.5px] font-mono text-white/60 mt-1">{size}</span>
                         
                         {/* Absolute Custom Tooltip */}
                         <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover/size:opacity-100 transition-all duration-200 transform scale-95 group-hover/size:scale-100 bg-[#12131a] border border-amber-500/30 text-amber-300 text-[9px] font-mono px-2 py-0.5 rounded shadow-xl whitespace-nowrap z-50 flex items-center gap-1">
                           <span class="font-bold">{size}</span>
                           <span class="text-white/40">|</span>
                           <span class="text-white/70">{px}</span>
                         </div>
                       </div>
                    );
                  };

                  const mainColor = () => fillMode() === 'gradient' 
                    ? `url(#gold-grad-${type})` 
                    : `url(#gold-pattern-${type})`;
                  const mainGradientColor = () => `url(#gold-grad-${type})`;

                  return (
                    <div
                      class="p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all flex flex-col items-center"
                    >
                      <div class="text-center mb-3">
                        <span class="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">{type === 'medium' ? 'Active Config' : `${type} view`}</span>
                        <span class="text-[10px] text-white/40 block mt-0.5">Border: {borderStrokeWidth()}px | K: {currentKStrokeWidth()}px</span>
                      </div>
                      
                      {/* SVG Render box */}
                      <div
                        class="w-40 h-40 bg-black/50 border border-white/10 rounded-lg flex items-center justify-center relative group overflow-hidden shadow-inner mb-3"
                      >
                        <div class="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        <svg viewBox="0 0 100 100" class="w-28 h-28" style={glowIntensity() > 0 ? { filter: `drop-shadow(0 0 ${glowIntensity()}px rgba(251, 191, 36, 0.45))` } : {}}>
                          <defs>
                            {/* Standard Gradient (Linear or Radial) */}
                            <Show when={!isRadialActive()}>
                              <linearGradient 
                                id={`gold-grad-${type}`} 
                                x1={cardCoords().x1} 
                                y1={cardCoords().y1} 
                                x2={cardCoords().x2} 
                                y2={cardCoords().y2} 
                                gradientUnits="userSpaceOnUse"
                                spreadMethod="reflect"
                              >
                                <Show when={gradientProfile() === 'A'}>
                                  <stop offset="0%" stop-color="#FFF3C2" />
                                  <stop offset="25%" stop-color="#E2B857" />
                                  <stop offset="50%" stop-color="#FCF6BA" />
                                  <stop offset="75%" stop-color="#B28424" />
                                  <stop offset="100%" stop-color="#FCD267" />
                                </Show>
                                <Show when={gradientProfile() === 'B'}>
                                  <stop offset="0%" stop-color="#251502" />
                                  <stop offset="25%" stop-color="#E5B842" />
                                  <stop offset="50%" stop-color="#FFF7C7" />
                                  <stop offset="75%" stop-color="#E5B842" />
                                  <stop offset="100%" stop-color="#251502" />
                                </Show>
                                <Show when={gradientProfile() === 'C'}>
                                  <stop offset="0%" stop-color="#FFF2C2" />
                                  <stop offset="30%" stop-color="#C5A44E" />
                                  <stop offset="50%" stop-color="#A48748" />
                                  <stop offset="70%" stop-color="#EDCD75" />
                                  <stop offset="100%" stop-color="#B7984A" />
                                </Show>
                                <Show when={gradientProfile() === 'D'}>
                                  <stop offset="0%" stop-color="#EBEFF5" />
                                  <stop offset="25%" stop-color="#B5B9BF" />
                                  <stop offset="50%" stop-color="#EDF1F7" />
                                  <stop offset="75%" stop-color="#83878D" />
                                  <stop offset="100%" stop-color="#CED2D8" />
                                </Show>
                                <Show when={gradientProfile() === 'E'}>
                                  <stop offset="0%" stop-color="#D1D5DB" />
                                  <stop offset="30%" stop-color="#6B7280" />
                                  <stop offset="50%" stop-color="#374151" />
                                  <stop offset="70%" stop-color="#9CA3AF" />
                                  <stop offset="100%" stop-color="#4B5563" />
                                </Show>
                                <Show when={gradientProfile() === 'F'}>
                                  <stop offset="0%" stop-color="#9CA3AF" />
                                  <stop offset="25%" stop-color="#4B5563" />
                                  <stop offset="50%" stop-color="#1F2937" />
                                  <stop offset="75%" stop-color="#111827" />
                                  <stop offset="100%" stop-color="#374151" />
                                </Show>
                                <Show when={gradientProfile() === 'G'}>
                                  <stop offset="0%" stop-color="#55411B" />
                                  <stop offset="15%" stop-color="#997E47" />
                                  <stop offset="30%" stop-color="#55411B" />
                                  <stop offset="45%" stop-color="#FFFDDA" />
                                  <stop offset="60%" stop-color="#D5BB8A" />
                                  <stop offset="75%" stop-color="#B8A269" />
                                  <stop offset="85%" stop-color="#55411B" />
                                  <stop offset="100%" stop-color="#FBECA9" />
                                </Show>
                                <Show when={gradientProfile() === 'I'}>
                                  <stop offset="0%" stop-color="#7C6535" />
                                  <stop offset="15%" stop-color="#997E47" />
                                  <stop offset="30%" stop-color="#7C6535" />
                                  <stop offset="45%" stop-color="#FFFDDA" />
                                  <stop offset="60%" stop-color="#D5BB8A" />
                                  <stop offset="75%" stop-color="#B8A269" />
                                  <stop offset="85%" stop-color="#7C6535" />
                                  <stop offset="100%" stop-color="#FBECA9" />
                                </Show>
                                <Show when={gradientProfile() === 'J'}>
                                  <stop offset="0%" stop-color="#7C6535" />
                                  <stop offset="8%" stop-color="#997E47" />
                                  <stop offset="26%" stop-color="#B8A269" />
                                  <stop offset="30%" stop-color="#7C6535" />
                                  <stop offset="34%" stop-color="#FFFDDA" />
                                  <stop offset="60%" stop-color="#D5BB8A" />
                                  <stop offset="81%" stop-color="#B8A269" />
                                  <stop offset="85%" stop-color="#7C6535" />
                                  <stop offset="93%" stop-color="#FBECA9" />
                                  <stop offset="100%" stop-color="#7C6535" />
                                </Show>
                                <Show when={gradientProfile() === 'K'}>
                                  <stop offset="0%" stop-color="#FFFDDA" />
                                  <stop offset="31%" stop-color="#D5BB8A" />
                                  <stop offset="44%" stop-color="#7C6535" />
                                  <stop offset="100%" stop-color="#55411B" />
                                </Show>
                                <Show when={gradientProfile() === 'Custom'}>
                                  <For each={[...customStops()].sort((a, b) => a.offset - b.offset)}>
                                    {(stop) => (
                                      <stop offset={`${stop.offset}%`} stop-color={stop.color} />
                                    )}
                                  </For>
                                </Show>
                              </linearGradient>
                            </Show>
                            <Show when={isRadialActive()}>
                              <radialGradient
                                id={`gold-grad-${type}`}
                                cx={cardRadialCoords().cx}
                                cy={cardRadialCoords().cy}
                                r={cardRadialCoords().r}
                                fx={cardRadialCoords().fx}
                                fy={cardRadialCoords().fy}
                                gradientUnits="userSpaceOnUse"
                              >
                                <Show when={gradientProfile() === 'R1'}>
                                  <stop offset="0%" stop-color="#FFFDDA" />
                                  <stop offset="15%" stop-color="#D5BB8A" />
                                  <stop offset="35%" stop-color="#7C6535" />
                                  <stop offset="55%" stop-color="#FFFDDA" />
                                  <stop offset="75%" stop-color="#D5BB8A" />
                                  <stop offset="90%" stop-color="#7C6535" />
                                  <stop offset="100%" stop-color="#55411B" />
                                </Show>
                                <Show when={gradientProfile() === 'R2'}>
                                  <stop offset="0%" stop-color="#FFFDDA" />
                                  <stop offset="25%" stop-color="#D5BB8A" />
                                  <stop offset="60%" stop-color="#7C6535" />
                                  <stop offset="100%" stop-color="#55411B" />
                                </Show>
                                <Show when={gradientProfile() === 'Custom'}>
                                  <For each={[...customStops()].sort((a, b) => a.offset - b.offset)}>
                                    {(stop) => (
                                      <stop offset={`${stop.offset}%`} stop-color={stop.color} />
                                    )}
                                  </For>
                                </Show>
                              </radialGradient>
                            </Show>

                            {/* Softbox reflection box pattern & blur filter */}
                            <Show when={customType() === 'box'}>
                              <filter id={`softbox-blur-${type}-${uniqueId}`} x="-100%" y="-100%" width="300%" height="300%">
                                <feGaussianBlur stdDeviation={boxBlur()} />
                              </filter>
                              
                              <pattern 
                                id={`gold-box-pattern-${type}`} 
                                patternUnits="userSpaceOnUse" 
                                x={activeCardShiftX()}
                                y={activeCardShiftY()}
                                width="100" 
                                height="100"
                              >
                                <rect 
                                  x={50 - boxWidth() / 2} 
                                  y={50 - boxHeight() / 2} 
                                  width={boxWidth()} 
                                  height={boxHeight()} 
                                  rx={boxCornerRadius()} 
                                  ry={boxCornerRadius()} 
                                  fill={boxColor()} 
                                  opacity={boxOpacity()}
                                  filter={`url(#softbox-blur-${type}-${uniqueId})`}
                                />
                              </pattern>

                              {/* Optical pattern version */}
                              <pattern 
                                id={`gold-box-pattern-optical-${type}`} 
                                patternUnits="userSpaceOnUse" 
                                x={activeCardShiftX()}
                                y={activeCardShiftY()}
                                width="100" 
                                height="100"
                              >
                                <rect 
                                  x={50 - boxWidth() / 2} 
                                  y={50 - boxHeight() / 2} 
                                  width={boxWidth()} 
                                  height={boxHeight()} 
                                  rx={boxCornerRadius()} 
                                  ry={boxCornerRadius()} 
                                  fill={boxColor()} 
                                  opacity={boxOpacity()}
                                  filter={`url(#softbox-blur-${type}-${uniqueId})`}
                                />
                              </pattern>
                             </Show>
                              


                            {/* Optical Sizing Gradient for smaller cell views */}
                            <Show when={!isRadialActive()}>
                              <linearGradient 
                                id={`gold-grad-optical-${type}`} 
                                x1={cardCoords().x1} 
                                y1={cardCoords().y1} 
                                x2={cardCoords().x2} 
                                y2={cardCoords().y2} 
                                gradientUnits="userSpaceOnUse"
                                spreadMethod="reflect"
                              >
                                <Show when={['A', 'B', 'C', 'G', 'I', 'J', 'K'].includes(gradientProfile())}>
                                  {/* Smooth Gold */}
                                  <stop offset="0%" stop-color="#78581E" />
                                  <stop offset="30%" stop-color="#E2B857" />
                                  <stop offset="55%" stop-color="#FFF3C2" />
                                  <stop offset="80%" stop-color="#E2B857" />
                                  <stop offset="100%" stop-color="#9E782F" />
                                </Show>
                                <Show when={['D', 'E', 'F'].includes(gradientProfile())}>
                                  {/* Smooth Silver */}
                                  <stop offset="0%" stop-color="#70757D" />
                                  <stop offset="30%" stop-color="#CED2D8" />
                                  <stop offset="55%" stop-color="#EBEFF5" />
                                  <stop offset="80%" stop-color="#CED2D8" />
                                  <stop offset="100%" stop-color="#5B5F66" />
                                </Show>
                                <Show when={gradientProfile() === 'Custom'}>
                                  <For each={[...customStops()].sort((a, b) => a.offset - b.offset)}>
                                    {(stop) => (
                                      <stop offset={`${stop.offset}%`} stop-color={stop.color} />
                                    )}
                                  </For>
                                </Show>
                              </linearGradient>
                            </Show>
                            <Show when={isRadialActive()}>
                              <radialGradient 
                                id={`gold-grad-optical-${type}`} 
                                cx={cardRadialCoords().cx}
                                cy={cardRadialCoords().cy}
                                r={cardRadialCoords().r}
                                fx={cardRadialCoords().fx}
                                fy={cardRadialCoords().fy}
                                gradientUnits="userSpaceOnUse"
                              >
                                <Show when={gradientProfile() !== 'Custom'}>
                                  <stop offset="0%" stop-color="#FFFDDA" />
                                  <stop offset="35%" stop-color="#D5BB8A" />
                                  <stop offset="70%" stop-color="#78581E" />
                                  <stop offset="100%" stop-color="#4E3D1E" />
                                </Show>
                                <Show when={gradientProfile() === 'Custom'}>
                                  <For each={[...customStops()].sort((a, b) => a.offset - b.offset)}>
                                    {(stop) => (
                                      <stop offset={`${stop.offset}%`} stop-color={stop.color} />
                                    )}
                                  </For>
                                </Show>
                              </radialGradient>
                            </Show>

                            <pattern id={`gold-pattern-${type}`} patternUnits="userSpaceOnUse" x={textureOffsetX() + (interactiveSheen() ? interactiveShiftX() : 0)} y={textureOffsetY() + (interactiveSheen() ? interactiveShiftY() : 0)} width={100 * textureScale()} height={100 * textureScale()}>
                              <image href={`/gold-textures/${selectedTexture()}`} x="0" y="0" width={100 * textureScale()} height={100 * textureScale()} preserveAspectRatio="xMidYMid slice" style={{ filter: `brightness(${textureBrightness()}) contrast(${textureContrast()}) saturate(${textureSaturation()})` }} />
                            </pattern>

                            {/* Horizontal clip path to cut diagonal stroke extensions perfectly flat */}
                            <clipPath id={`k-horizontal-clip-${type}`}>
                              <rect x="10" y={c().clipY} width="80" height={c().clipHeight} />
                            </clipPath>
                            {/* Static definitions for size cells */}
                            <Show when={!isRadialActive()}>
                              <linearGradient 
                                id={`gold-grad-static-${type}`} 
                                href={`#gold-grad-${type}`}
                                x1={cardCoordsStatic().x1} 
                                y1={cardCoordsStatic().y1} 
                                x2={cardCoordsStatic().x2} 
                                y2={cardCoordsStatic().y2} 
                                gradientUnits="userSpaceOnUse"
                                spreadMethod="reflect"
                              />
                              <linearGradient 
                                id={`gold-grad-optical-static-${type}`} 
                                href={`#gold-grad-optical-${type}`}
                                x1={cardCoordsStatic().x1} 
                                y1={cardCoordsStatic().y1} 
                                x2={cardCoordsStatic().x2} 
                                y2={cardCoordsStatic().y2} 
                                gradientUnits="userSpaceOnUse"
                                spreadMethod="reflect"
                              />
                            </Show>
                            <Show when={isRadialActive()}>
                              <radialGradient
                                id={`gold-grad-static-${type}`}
                                href={`#gold-grad-${type}`}
                                cx={cardRadialCoordsStatic().cx}
                                cy={cardRadialCoordsStatic().cy}
                                r={cardRadialCoordsStatic().r}
                                fx={cardRadialCoordsStatic().fx}
                                fy={cardRadialCoordsStatic().fy}
                                gradientUnits="userSpaceOnUse"
                              />
                              <radialGradient
                                id={`gold-grad-optical-static-${type}`}
                                href={`#gold-grad-optical-${type}`}
                                cx={cardRadialCoordsStatic().cx}
                                cy={cardRadialCoordsStatic().cy}
                                r={cardRadialCoordsStatic().r}
                                fx={cardRadialCoordsStatic().fx}
                                fy={cardRadialCoordsStatic().fy}
                                gradientUnits="userSpaceOnUse"
                              />
                            </Show>

                            <Show when={customType() === 'box'}>
                              <pattern 
                                id={`gold-box-pattern-static-${type}`} 
                                href={`#gold-box-pattern-${type}`}
                                x="0" 
                                y="0"
                                patternUnits="userSpaceOnUse" 
                              />
                              <pattern 
                                id={`gold-box-pattern-optical-static-${type}`} 
                                href={`#gold-box-pattern-optical-${type}`}
                                x="0" 
                                y="0"
                                patternUnits="userSpaceOnUse" 
                              />
                            </Show>

                            <pattern 
                              id={`gold-pattern-static-${type}`} 
                              href={`#gold-pattern-${type}`}
                              x={textureOffsetX()} 
                              y={textureOffsetY()}
                              patternUnits="userSpaceOnUse" 
                            />
                          </defs>

                          {/* Dummy element to force browser repaint of optical gradients */}
                          <rect width="0" height="0" fill={`url(#gold-grad-optical-${type})`} />

                              {/* Hexagon Shadow Outline */}
                              <For each={Array.from({ length: rings() }, (_, i) => i)}>
                                {(index) => (
                                  <polygon 
                                    points={getHexagonPoints(index, borderStrokeWidth())} 
                                    fill={index === 0 ? mainColor() : 'none'} 
                                    fill-opacity={index === 0 ? hexFillOpacity() : 0}
                                    stroke="#201A0A" 
                                    stroke-width={borderStrokeWidth() + bevelOffset() * 1.5}
                                    stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                    transform={`translate(${bevelOffset()}, ${bevelOffset()})`}
                                  />
                                )}
                              </For>
                              {/* Hexagon Highlight Outline */}
                              <For each={Array.from({ length: rings() }, (_, i) => i)}>
                                {(index) => (
                                  <polygon 
                                    points={getHexagonPoints(index, borderStrokeWidth())} 
                                    fill="none" 
                                    stroke="#FFFDDA" 
                                    stroke-width={borderStrokeWidth() + bevelOffset() * 0.5}
                                    stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                    transform={`translate(${-bevelOffset()}, ${-bevelOffset()})`}
                                    opacity={bevelOpacity()}
                                  />
                                )}
                              </For>
                              {/* Hexagon Main Face */}
                              <For each={Array.from({ length: rings() }, (_, i) => i)}>
                                {(index) => (
                                  <polygon 
                                    points={getHexagonPoints(index, borderStrokeWidth())} 
                                    fill={index === 0 ? mainColor() : 'none'} 
                                    fill-opacity={index === 0 ? hexFillOpacity() : 0}
                                    stroke={mainColor()} 
                                    stroke-width={borderStrokeWidth()}
                                    stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                  />
                                )}
                              </For>
                              
                              {/* Hexagon Softbox Specular Overlay */}
                              <Show when={fillMode() === 'gradient' && customType() === 'box'}>
                                <For each={Array.from({ length: rings() }, (_, i) => i)}>
                                  {(index) => (
                                    <polygon 
                                      points={getHexagonPoints(index, borderStrokeWidth())} 
                                      fill={index === 0 ? `url(#gold-box-pattern-${type})` : 'none'} 
                                      fill-opacity={index === 0 ? hexFillOpacity() : 0}
                                      stroke={`url(#gold-box-pattern-${type})`} 
                                      stroke-width={borderStrokeWidth()}
                                      stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                      style={{
                                        "mix-blend-mode": boxMixBlendMode(),
                                        "pointer-events": "none"
                                      }}
                                    />
                                  )}
                                </For>
                              </Show>

                              <Show when={fillMode() === 'texture' && overlayOpacity() > 0}>
                                <For each={Array.from({ length: rings() }, (_, i) => i)}>
                                  {(index) => (
                                    <polygon 
                                      points={getHexagonPoints(index, borderStrokeWidth())} 
                                      fill={index === 0 ? mainGradientColor() : 'none'} 
                                      fill-opacity={index === 0 ? hexFillOpacity() : 0}
                                      stroke={mainGradientColor()} 
                                      stroke-width={borderStrokeWidth()}
                                      stroke-linejoin={linecap() === 'round' ? 'round' : 'miter'}
                                      style={{
                                        "mix-blend-mode": overlayBlendMode(),
                                        opacity: overlayOpacity(),
                                        "pointer-events": "none"
                                      }}
                                    />
                                  )}
                                </For>
                              </Show>

                              {/* 1. K SHADOWS */}
                              <path 
                                d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                                fill="none"
                                stroke="#201A0A"
                                stroke-width={currentKStrokeWidth() + bevelOffset() * 1.5}
                                stroke-linecap={linecap()}
                                transform={`translate(${bevelOffset()}, ${bevelOffset()})`}
                              />
                              <g clip-path={`url(#k-horizontal-clip-${type})`}>
                                <path 
                                  d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                  fill="none"
                                  stroke="#201A0A"
                                  stroke-width={currentKStrokeWidth() + bevelOffset() * 1.5}
                                  stroke-linecap={linecap()}
                                  stroke-linejoin="miter"
                                  transform={`translate(${bevelOffset()}, ${bevelOffset()})`}
                                />
                                <path 
                                  d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                  fill="none"
                                  stroke="#201A0A"
                                  stroke-width={currentKStrokeWidth() + bevelOffset() * 1.5}
                                  stroke-linecap={linecap()}
                                  stroke-linejoin="miter"
                                  transform={`translate(${bevelOffset()}, ${bevelOffset()})`}
                                />
                              </g>

                              {/* 2. K HIGHLIGHTS */}
                              <path 
                                d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                                fill="none"
                                stroke="#FFFDDA"
                                stroke-width={currentKStrokeWidth() + bevelOffset() * 0.5}
                                stroke-linecap={linecap()}
                                transform={`translate(${-bevelOffset()}, ${-bevelOffset()})`}
                                opacity={bevelOpacity()}
                              />
                              <g clip-path={`url(#k-horizontal-clip-${type})`}>
                                <path 
                                  d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                  fill="none"
                                  stroke="#FFFDDA"
                                  stroke-width={currentKStrokeWidth() + bevelOffset() * 0.5}
                                  stroke-linecap={linecap()}
                                  stroke-linejoin="miter"
                                  transform={`translate(${-bevelOffset()}, ${-bevelOffset()})`}
                                  opacity={bevelOpacity()}
                                />
                                <path 
                                  d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                  fill="none"
                                  stroke="#FFFDDA"
                                  stroke-width={currentKStrokeWidth() + bevelOffset() * 0.5}
                                  stroke-linecap={linecap()}
                                  stroke-linejoin="miter"
                                  transform={`translate(${-bevelOffset()}, ${-bevelOffset()})`}
                                  opacity={bevelOpacity()}
                                />
                              </g>

                              {/* 3. K MAINS */}
                              <path 
                                d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                                fill="none"
                                stroke={mainColor()}
                                stroke-width={currentKStrokeWidth()}
                                stroke-linecap={linecap()}
                              />
                              <g clip-path={`url(#k-horizontal-clip-${type})`}>
                                <path 
                                  d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                  fill="none"
                                  stroke={mainColor()}
                                  stroke-width={currentKStrokeWidth()}
                                  stroke-linecap={linecap()}
                                  stroke-linejoin="miter"
                                />
                                <path 
                                  d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                  fill="none"
                                  stroke={mainColor()}
                                  stroke-width={currentKStrokeWidth()}
                                  stroke-linecap={linecap()}
                                  stroke-linejoin="miter"
                                />
                              </g>

                              {/* 4. K TEXTURE OVERLAYS */}
                              <Show when={fillMode() === 'texture' && overlayOpacity() > 0}>
                                <path 
                                  d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                                  fill="none"
                                  stroke={mainGradientColor()}
                                  stroke-width={currentKStrokeWidth()}
                                  stroke-linecap={linecap()}
                                  style={{
                                    "mix-blend-mode": overlayBlendMode(),
                                    opacity: overlayOpacity(),
                                    "pointer-events": "none"
                                  }}
                                />
                                <g clip-path={`url(#k-horizontal-clip-${type})`}>
                                  <path 
                                    d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                    fill="none"
                                    stroke={mainGradientColor()}
                                    stroke-width={currentKStrokeWidth()}
                                    stroke-linecap={linecap()}
                                    stroke-linejoin="miter"
                                    style={{
                                      "mix-blend-mode": overlayBlendMode(),
                                      opacity: overlayOpacity(),
                                      "pointer-events": "none"
                                    }}
                                  />
                                  <path 
                                    d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                    fill="none"
                                    stroke={mainGradientColor()}
                                    stroke-width={currentKStrokeWidth()}
                                    stroke-linecap={linecap()}
                                    stroke-linejoin="miter"
                                    style={{
                                      "mix-blend-mode": overlayBlendMode(),
                                      opacity: overlayOpacity(),
                                      "pointer-events": "none"
                                    }}
                                  />
                                </g>
                              </Show>

                              {/* 4.5. K Softbox Specular Overlay */}
                              <Show when={fillMode() === 'gradient' && customType() === 'box'}>
                                <path 
                                  d={`M ${c().stemX1},${c().stemY1} L ${c().stemX2},${c().stemY2}`}
                                  fill="none"
                                  stroke={`url(#gold-box-pattern-${type})`}
                                  stroke-width={currentKStrokeWidth()}
                                  stroke-linecap={linecap()}
                                  style={{
                                    "mix-blend-mode": boxMixBlendMode(),
                                    "pointer-events": "none"
                                  }}
                                />
                                <g clip-path={`url(#k-horizontal-clip-${type})`}>
                                  <path 
                                    d={`M ${c().diag1X1},${c().diag1Y1} L ${c().diag1X2},${c().diag1Y2}`}
                                    fill="none"
                                    stroke={`url(#gold-box-pattern-${type})`}
                                    stroke-width={currentKStrokeWidth()}
                                    stroke-linecap={linecap()}
                                    stroke-linejoin="miter"
                                    style={{
                                      "mix-blend-mode": boxMixBlendMode(),
                                      "pointer-events": "none"
                                    }}
                                  />
                                  <path 
                                    d={`M ${c().diag2X1},${c().diag2Y1} L ${c().diag2X2},${c().diag2Y2}`}
                                    fill="none"
                                    stroke={`url(#gold-box-pattern-${type})`}
                                    stroke-width={currentKStrokeWidth()}
                                    stroke-linecap={linecap()}
                                    stroke-linejoin="miter"
                                    style={{
                                      "mix-blend-mode": boxMixBlendMode(),
                                      "pointer-events": "none"
                                    }}
                                  />
                                </g>
                              </Show>
                        </svg>
                      </div>

                      {/* Scaling Preview Pyramid Grid */}
                      <div class="w-full bg-black/40 border border-white/5 rounded-lg p-2 mb-3">
                        <span class="text-[9px] text-white/40 block mb-1.5 font-mono text-center uppercase tracking-wider">Scale Preview</span>
                        <div class="flex flex-col gap-2 bg-black/20 p-2 rounded border border-white/5">
                          {/* Row 1: 4 items (1rem, 1.5rem, 2rem, 2.5rem) */}
                          <div class="flex items-end justify-center gap-2">
                            {renderSizeCell('1rem', '16px')}
                            {renderSizeCell('1.5rem', '24px')}
                            {renderSizeCell('2rem', '32px')}
                            {renderSizeCell('2.5rem', '40px')}
                          </div>
                          {/* Row 2: 3 items (3rem, 4rem, 4.5rem) */}
                          <div class="flex items-end justify-center gap-2">
                            {renderSizeCell('3rem', '48px')}
                            {renderSizeCell('4rem', '64px')}
                            {renderSizeCell('4.5rem', '72px')}
                          </div>
                          {/* Row 3: 2 items (5rem, 5.5rem) */}
                          <div class="flex items-end justify-center gap-2.5">
                            {renderSizeCell('5rem', '80px')}
                            {renderSizeCell('5.5rem', '88px')}
                          </div>
                          {/* Row 4: 1 item (6rem) */}
                          <div class="flex items-end justify-center">
                            {renderSizeCell('6rem', '96px')}
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Copy and Save/Load preset bar */}
                      <div class="w-full flex flex-col gap-1.5 border-t border-white/5 pt-2 mb-3">
                        <button 
                          onClick={() => handleCopySVG(type)}
                          class={`w-full py-1 text-[11px] font-mono rounded border transition-all text-center ${copiedType() === type ? 'bg-green-500/20 border-green-500/50 text-green-300 font-semibold' : 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/20 text-amber-300'}`}
                        >
                          {copiedType() === type ? '✓ SVG COPIED!' : '📋 COPY SVG TO CLIPBOARD'}
                        </button>
                        
                        <div class="flex items-center gap-1">
                          <select 
                            value={type === 'thin' ? selectedSlotThin() : type === 'medium' ? selectedSlotMedium() : selectedSlotThick()}
                            onChange={(e) => {
                              const val = e.currentTarget.value;
                              if (type === 'thin') setSelectedSlotThin(val);
                              else if (type === 'medium') setSelectedSlotMedium(val);
                              else setSelectedSlotThick(val);
                            }}
                            class="flex-1 bg-black/60 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/80 font-mono outline-none focus:border-amber-500/50"
                          >
                            <option value="1">{checkSlotText('1')}</option>
                            <option value="2">{checkSlotText('2')}</option>
                            <option value="3">{checkSlotText('3')}</option>
                            <option value="4">{checkSlotText('4')}</option>
                            <option value="5">{checkSlotText('5')}</option>
                          </select>
                          
                          <button 
                            onClick={() => {
                              const slot = type === 'thin' ? selectedSlotThin() : type === 'medium' ? selectedSlotMedium() : selectedSlotThick();
                              savePreset(type, slot);
                            }}
                            class={`px-2 py-0.5 text-[10px] font-mono border rounded transition-all ${savedFeedback() === `${type}-${type === 'thin' ? selectedSlotThin() : type === 'medium' ? selectedSlotMedium() : selectedSlotThick()}` ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 hover:border-white/30 text-white/80 hover:bg-white/10'}`}
                          >
                            {savedFeedback() === `${type}-${type === 'thin' ? selectedSlotThin() : type === 'medium' ? selectedSlotMedium() : selectedSlotThick()}` ? 'Saved' : 'Save'}
                          </button>
                          
                          <button 
                            onClick={() => {
                              const slot = type === 'thin' ? selectedSlotThin() : type === 'medium' ? selectedSlotMedium() : selectedSlotThick();
                              loadPreset(slot);
                            }}
                            class="px-2 py-0.5 text-[10px] font-mono bg-white/5 border border-white/10 hover:border-amber-500/50 text-white/80 hover:text-amber-300 rounded hover:bg-amber-500/5 transition-all"
                          >
                            Load
                          </button>
                        </div>
                      </div>

                      {/* Code Block for Copying */}
                      <div class="w-full">
                        <span class="text-[9px] text-white/30 block mb-0.5 font-mono">SVG markup preview:</span>
                        <pre class="bg-black/80 text-[8px] p-1.5 rounded text-white/40 overflow-x-auto max-h-16 custom-scrollbar font-mono leading-tight">
{getSVGMarkupString(type)}
                        </pre>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </section>

        {/* SECTION 2: 3D Rendered Asset Sheets (PNG) */}
        <section class="mb-12">
          <h2 class="text-xl font-bold tracking-wide text-white border-l-2 border-amber-500 pl-3 mb-6">
            2. High-Quality 3D Render Assets (PNG)
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <For each={pngVariations}>
              {(item) => (
                <div class="group relative rounded-lg border border-white/10 bg-white/[0.01] overflow-hidden hover:border-amber-500/40 hover:bg-white/[0.03] transition-all flex flex-col">
                  {/* Aspect ratio box for image */}
                  <div class="aspect-square w-full bg-black/60 flex items-center justify-center p-6 border-b border-white/10 relative">
                    {/* Glowing mesh background */}
                    <div class="absolute inset-0 bg-radial-gradient from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                    <img 
                      src={item.src} 
                      alt={item.name} 
                      class="max-w-[75%] max-h-[75%] object-contain select-none filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-500" 
                    />
                  </div>
                  
                  {/* Meta Details */}
                  <div class="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 class="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">{item.name}</h3>
                      <p class="text-xs text-white/50 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                    <div class="mt-4 flex gap-2">
                      <a 
                        href={item.src} 
                        download={item.src.split('/').pop()}
                        class="flex-1 text-center py-1.5 text-[11px] font-mono border border-white/10 rounded hover:border-amber-500/40 hover:bg-amber-500/10 text-white/80 hover:text-amber-300 transition-all"
                      >
                        DOWNLOAD PNG
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>

        {/* SECTION 3: SVG Texture Masking Tutorial */}
        <section class="p-6 rounded-lg border border-white/10 bg-white/[0.01] backdrop-blur-md">
          <h2 class="text-lg font-bold text-white mb-3">
            3. SVG Texture Masking Implementation Guide
          </h2>
          <p class="text-xs text-white/60 leading-relaxed mb-4">
            If you want to apply a photo-realistic gold foil texture image dynamically to the vector hexagon icon in your game frontend rather than just using gradient vectors, you can use an SVG `&lt;mask&gt;` or `&lt;clipPath&gt;`. The mask controls which pixels of the texture image are shown.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 class="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase mb-2">Masking Code Example</h3>
              <pre class="bg-black/80 text-[10.5px] p-3 rounded border border-white/5 text-white/60 overflow-x-auto font-mono leading-relaxed">
{`<svg viewBox="0 0 100 100">
  <defs>
    <!-- Define the mask -->
    <mask id="gold-coin-mask">
      <!-- Black hides everything, White reveals -->
      <polygon 
        points="27.5,11 72.5,11 95,50 72.5,89 27.5,89 5,50" 
        fill="none" 
        stroke="white" 
        stroke-width="6" 
      />
      <path d="M 38,28 L 38.01,72" stroke="white" stroke-width="6"/>
      <g clip-path="url(#k-clip)">
        <path d="M 38,50 L 65,24.5" stroke="white" stroke-width="6"/>
        <path d="M 43,44.5 L 65,75.5" stroke="white" stroke-width="6"/>
      </g>
    </mask>
    <clipPath id="k-clip"><rect x="10" y="28" width="80" height="44" /></clipPath>
  </defs>

  <!-- Apply the mask to a background gold texture image -->
  <image 
    href="/art/textures/gold_foil.jpg" 
    width="100" 
    height="100" 
    mask="url(#gold-coin-mask)" 
  />
</svg>`}
              </pre>
            </div>
            
            <div class="flex flex-col justify-between">
              <div>
                <h3 class="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase mb-2">Key Technical Benefits</h3>
                <ul class="list-disc list-inside text-xs text-white/60 space-y-2 leading-relaxed">
                  <li><strong class="text-white/80">Infinite Scalability</strong>: Border outline calculations remain vector crisp while the gold pattern resolution scales seamlessly.</li>
                  <li><strong class="text-white/80">Interactive Styling</strong>: Since the mask contains shape nodes, you can animate the stroke thickness, scale, or draw-in strokes using simple CSS variables.</li>
                  <li><strong class="text-white/80">Lighting & Specular Maps</strong>: You can overlay SVG filter lighting effects on top of the texture map to create glossy cyber shines reacting to cursor movements.</li>
                </ul>
              </div>
              <div class="p-3 bg-white/5 rounded border border-white/5 text-[11px] text-white/40 font-mono">
                Asset Path: <span class="text-white/60">/icons/icon_original.png</span> <br/>
                Route File: <span class="text-white/60">components/screens/IconsPreviewScreen.tsx</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Unified Motion & Reflex UI Sandbox Demo */}
        <section class="mt-12 p-8 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-md relative overflow-hidden">
          <div class="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full filter blur-3xl pointer-events-none" />
          
          <h2 class="text-xl font-bold tracking-wide text-white border-l-2 border-amber-500 pl-3 mb-2 flex items-center gap-2">
            <span>4. Unified Motion Reflex UI Sandbox</span>
            <Show when={interactiveSheen()}>
              <span class="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-mono font-normal animate-pulse">Holo-Reflex Active</span>
            </Show>
            <Show when={!interactiveSheen()}>
              <span class="text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded font-mono font-normal">Holo-Reflex Paused</span>
            </Show>
          </h2>
          <p class="text-xs text-white/60 leading-relaxed mb-6">
            Observe the entire UI—coins, typography, progress bars, and button sheens—shifting highlights in perfect unison as you move your mouse or tilt your device. Below is the live showcase of the lore-pivot currencies.
          </p>

          {/* Sandbox Live Grid */}
          <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
            
            {/* Column 1: Live Interactive Currency Cards */}
            <div class="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Gold Pack Card */}
              <div 
                class="bg-black/60 border border-white/5 hover:border-amber-500/30 p-5 rounded-lg transition-all flex flex-col justify-between group"
              >
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <span class="text-[10px] text-amber-500 font-mono tracking-wider uppercase block mb-1">Premium Tier</span>
                    <h3 class="text-md font-bold text-white flex items-center gap-1">
                      <ReflectiveText profile="gold" type={customType()}>
                        IMPERIAL GOLD
                      </ReflectiveText>
                    </h3>
                    <p class="text-xs text-white/50 mt-1.5 leading-relaxed">
                      The currency of high society. Rare, unreactive, and universally desired across the districts.
                    </p>
                  </div>
                  <KanIcon 
                    size={48} 
                    interactive={interactiveSheen()} 
                    gradientProfile={gradientProfile() === 'Custom' ? 'Custom' : 'J'}
                    customType={customType()}
                    boxWidth={boxWidth()}
                    boxHeight={boxHeight()}
                    boxBlur={boxBlur()}
                    boxColor={boxColor()}
                    boxOpacity={boxOpacity()}
                    boxCornerRadius={boxCornerRadius()}
                    boxMixBlendMode={boxMixBlendMode()}
                  />
                </div>
                
                <div class="space-y-4">
                  <div>
                    <div class="flex justify-between text-[10px] text-white/40 mb-1 font-mono">
                      <span>PACK RESERVE CAP</span>
                      <span>{demoProgress()}%</span>
                    </div>
                    <ReflectiveProgressBar 
                      value={demoProgress()} 
                      profile="gold" 
                      type={customType()} 
                    />
                  </div>
                  <div class="flex items-center justify-between pt-2">
                    <span class="text-xs text-white/40 font-mono">EST. WEIGHT: 12.5 kg</span>
                    <ReflectiveButton 
                      profile="gold" 
                      type={customType()}
                      onClick={() => alert('Purchasing Imperial Gold')}
                    >
                      ACQUIRE
                    </ReflectiveButton>
                  </div>
                </div>
              </div>

              {/* Silver Pack Card */}
              <div 
                class="bg-black/60 border border-white/5 hover:border-slate-400/30 p-5 rounded-lg transition-all flex flex-col justify-between group"
              >
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <span class="text-[10px] text-slate-400 font-mono tracking-wider uppercase block mb-1">Standard Tier</span>
                    <h3 class="text-md font-bold text-white flex items-center gap-1">
                      <ReflectiveText profile="silver" type={customType()}>
                        REFINED SILVER
                      </ReflectiveText>
                    </h3>
                    <p class="text-xs text-white/50 mt-1.5 leading-relaxed">
                      The bedrock of commercial exchange. Stamped and certified by the district treasuries.
                    </p>
                  </div>
                  <KanIcon 
                    size={48} 
                    interactive={interactiveSheen()} 
                    gradientProfile={gradientProfile() === 'Custom' ? 'Custom' : 'D'}
                    customType={customType()}
                    boxWidth={boxWidth()}
                    boxHeight={boxHeight()}
                    boxBlur={boxBlur()}
                    boxColor={boxColor()}
                    boxOpacity={boxOpacity()}
                    boxCornerRadius={boxCornerRadius()}
                    boxMixBlendMode={boxMixBlendMode()}
                  />
                </div>
                
                <div class="space-y-4">
                  <div>
                    <div class="flex justify-between text-[10px] text-white/40 mb-1 font-mono">
                      <span>PACK RESERVE CAP</span>
                      <span>{Math.max(0, demoProgress() - 15)}%</span>
                    </div>
                    <ReflectiveProgressBar 
                      value={Math.max(0, demoProgress() - 15)} 
                      profile="silver" 
                      type={customType()} 
                    />
                  </div>
                  <div class="flex items-center justify-between pt-2">
                    <span class="text-xs text-white/40 font-mono">EST. WEIGHT: 42.0 kg</span>
                    <ReflectiveButton 
                      profile="silver" 
                      type={customType()}
                      onClick={() => alert('Purchasing Refined Silver')}
                    >
                      ACQUIRE
                    </ReflectiveButton>
                  </div>
                </div>
              </div>

              {/* Brass Pack Card */}
              <div 
                class="bg-black/60 border border-white/5 hover:border-amber-700/30 p-5 rounded-lg transition-all flex flex-col justify-between group"
              >
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <span class="text-[10px] text-amber-700 font-mono tracking-wider uppercase block mb-1">Common Tier</span>
                    <h3 class="text-md font-bold text-white flex items-center gap-1">
                      <ReflectiveText profile="brass" type={customType()}>
                        COMMON BRASS
                      </ReflectiveText>
                    </h3>
                    <p class="text-xs text-white/50 mt-1.5 leading-relaxed">
                      Used for daily rations, train tickets, and minor trade. Heavily worn but reliable.
                    </p>
                  </div>
                  <KanIcon 
                    size={48} 
                    interactive={interactiveSheen()} 
                    gradientProfile={gradientProfile() === 'Custom' ? 'Custom' : 'G'}
                    customType={customType()}
                    boxWidth={boxWidth()}
                    boxHeight={boxHeight()}
                    boxBlur={boxBlur()}
                    boxColor={boxColor()}
                    boxOpacity={boxOpacity()}
                    boxCornerRadius={boxCornerRadius()}
                    boxMixBlendMode={boxMixBlendMode()}
                  />
                </div>
                
                <div class="space-y-4">
                  <div>
                    <div class="flex justify-between text-[10px] text-white/40 mb-1 font-mono">
                      <span>PACK RESERVE CAP</span>
                      <span>{Math.min(100, demoProgress() + 20)}%</span>
                    </div>
                    <ReflectiveProgressBar 
                      value={Math.min(100, demoProgress() + 20)} 
                      profile="brass" 
                      type={customType()} 
                    />
                  </div>
                  <div class="flex items-center justify-between pt-2">
                    <span class="text-xs text-white/40 font-mono">EST. WEIGHT: 110.4 kg</span>
                    <ReflectiveButton 
                      profile="brass" 
                      type={customType()}
                      onClick={() => alert('Purchasing Common Brass')}
                    >
                      ACQUIRE
                    </ReflectiveButton>
                  </div>
                </div>
              </div>

              {/* Mark (Lore Spec) Pack Card */}
              <div 
                class="bg-black/60 border border-white/5 hover:border-slate-500/30 p-5 rounded-lg transition-all flex flex-col justify-between group"
              >
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <span class="text-[10px] text-slate-500 font-mono tracking-wider uppercase block mb-1">Underworld Marker</span>
                    <h3 class="text-md font-bold text-white flex items-center gap-1">
                      <ReflectiveText profile="mark" type={customType()}>
                        UNDERWORLD MARK
                      </ReflectiveText>
                    </h3>
                    <p class="text-xs text-white/50 mt-1.5 leading-relaxed">
                      A heavy, dark iron coin stamped with the marker seal. Used for contracts and favors in the shadows.
                    </p>
                  </div>
                  <KanIcon 
                    size={48} 
                    interactive={interactiveSheen()} 
                    gradientProfile={gradientProfile() === 'Custom' ? 'Custom' : 'F'}
                    customType={customType()}
                    boxWidth={boxWidth()}
                    boxHeight={boxHeight()}
                    boxBlur={boxBlur()}
                    boxColor={boxColor()}
                    boxOpacity={boxOpacity()}
                    boxCornerRadius={boxCornerRadius()}
                    boxMixBlendMode={boxMixBlendMode()}
                  />
                </div>
                
                <div class="space-y-4">
                  <div>
                    <div class="flex justify-between text-[10px] text-white/40 mb-1 font-mono">
                      <span>PACK RESERVE CAP</span>
                      <span>{Math.max(0, 100 - demoProgress())}%</span>
                    </div>
                    <ReflectiveProgressBar 
                      value={Math.max(0, 100 - demoProgress())} 
                      profile="mark" 
                      type={customType()} 
                    />
                  </div>
                  <div class="flex items-center justify-between pt-2">
                    <span class="text-xs text-white/40 font-mono">EST. WEIGHT: 5.2 kg</span>
                    <ReflectiveButton 
                      profile="mark" 
                      type={customType()}
                      onClick={() => alert('Claiming Underworld Mark')}
                    >
                      CLAIM
                    </ReflectiveButton>
                  </div>
                </div>
              </div>

            </div>

            {/* Column 2: Rich Text Parser & Realtime Controls */}
            <div class="flex flex-col gap-4">
              
              {/* Rich Text Lore Render Card */}
              <div class="bg-black/60 border border-white/5 p-5 rounded-lg flex-1 flex flex-col justify-between">
                <div>
                  <h3 class="text-xs font-mono font-bold text-white/40 uppercase mb-3 tracking-wider">Inline RichText parser tags</h3>
                  <div class="bg-black/40 border border-white/5 p-4 rounded-lg space-y-3 mb-4 min-h-[140px] flex flex-col justify-center">
                    <p class="text-xs leading-relaxed text-white/70">
                      Our rich text engine translates tag markup inline. For example:
                    </p>
                    <div class="border-t border-white/5 pt-2 space-y-1">
                      <div>
                        <span class="text-[10px] text-white/40 font-mono block mb-1">Standard tags:</span>
                        <MaterialRichText value="The merchant requested [gold]150 Gold[/gold] or [silver]500 Silver[/silver] to trade." />
                      </div>
                      <div class="pt-1">
                        <span class="text-[10px] text-white/40 font-mono block mb-1">Asian lore tags:</span>
                        <MaterialRichText value="A seal stamped in [brass]Brass[/brass] was signed for [kan]30 Kan[/kan]." />
                      </div>
                      <div class="pt-1">
                        <span class="text-[10px] text-white/40 font-mono block mb-1">Shadow/Sys tags:</span>
                        <MaterialRichText value="Pay [mark]1 Mark[/mark] to unlock or use [credit]99 Credits[/credit]." />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="border-t border-white/5 pt-3">
                  <span class="text-[10px] text-white/40 font-mono block mb-1.5 uppercase">Test Custom RichText Input</span>
                  <input 
                    type="text" 
                    value={customInputText()}
                    onInput={(e) => setCustomInputText(e.currentTarget.value)}
                    class="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-amber-500/50 font-mono"
                  />
                  <div class="mt-2.5 p-2 bg-black/20 rounded border border-white/5 text-xs text-center min-h-[30px] flex items-center justify-center">
                    <MaterialRichText value={customInputText()} />
                  </div>
                </div>
              </div>

              {/* Parallax Demo Slider */}
              <div class="bg-black/60 border border-white/5 p-5 rounded-lg">
                <h3 class="text-xs font-mono font-bold text-white/40 uppercase mb-3 tracking-wider">Interactive Simulation</h3>
                
                <div class="space-y-4">
                  <div>
                    <div class="flex justify-between text-xs text-white/80 mb-1">
                      <span>Reserve Cap fill:</span>
                      <span class="font-mono text-amber-400 font-semibold">{demoProgress()}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={demoProgress()} 
                      onInput={(e) => setDemoProgress(parseInt(e.currentTarget.value))}
                      class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                    />
                  </div>

                  <div class="pt-2 text-[10px] text-white/40 leading-relaxed font-mono">
                    <div class="flex justify-between mb-1">
                      <span>Root Sheen X coordinate:</span>
                      <span class="text-white/70">{interactiveShiftX().toFixed(1)}px</span>
                    </div>
                    <div class="flex justify-between">
                      <span>Root Sheen Y coordinate:</span>
                      <span class="text-white/70">{interactiveShiftY().toFixed(1)}px</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Embossed Text Showcase Panel */}
          <div class="w-full bg-black/40 border border-white/5 rounded-lg p-5">
            <h3 class="text-xs font-mono font-bold text-white/40 uppercase mb-3 tracking-wider text-center">Embossed 3D Metallic Typography</h3>
            <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 py-2">
              <div class="text-center">
                <EmbossedReflectiveText profile="gold" type={customType()} class="text-xl uppercase tracking-widest font-black">
                  GOLD EMBOSS
                </EmbossedReflectiveText>
                <span class="text-[9px] text-white/30 block mt-1 font-mono">Double Shadow Offset</span>
              </div>
              <div class="text-center">
                <EmbossedReflectiveText profile="silver" type={customType()} class="text-xl uppercase tracking-widest font-black">
                  SILVER CHISEL
                </EmbossedReflectiveText>
                <span class="text-[9px] text-white/30 block mt-1 font-mono">Reflective Metallic</span>
              </div>
              <div class="text-center">
                <EmbossedReflectiveText profile="brass" type={customType()} class="text-xl uppercase tracking-widest font-black">
                  BRASS SHIELD
                </EmbossedReflectiveText>
                <span class="text-[9px] text-white/30 block mt-1 font-mono">Dark Specular</span>
              </div>
              <div class="text-center">
                <EmbossedReflectiveText profile="mark" type={customType()} class="text-xl uppercase tracking-widest font-black">
                  MARK CONTRACT
                </EmbossedReflectiveText>
                <span class="text-[9px] text-white/30 block mt-1 font-mono">John Wick Lore</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
};
