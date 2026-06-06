import { createSignal, For, Show } from 'solid-js';

export const IconsPreviewScreen = () => {
  // Signals for interactive SVG controls
  const [thickness, setThickness] = createSignal(3.5);
  const [kThickness, setKThickness] = createSignal(6.5);
  const [hexFillOpacity, setHexFillOpacity] = createSignal(0.12);
  const [glowIntensity, setGlowIntensity] = createSignal(8);
  const [linecap, setLinecap] = createSignal<'butt' | 'round'>('butt');
  const [rings, setRings] = createSignal<1 | 2 | 3>(3);
  const [ringGap, setRingGap] = createSignal(6.5);
  const [kScale, setKScale] = createSignal(0.8);
  const [gradientProfile, setGradientProfile] = createSignal<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'>('G');
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
      setGlowIntensity(4);
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
      setGlowIntensity(8);
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
      setGlowIntensity(12);
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
      setGlowIntensity(10);
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
      ? `    <linearGradient id="gold" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">\n${getGradientStopsString()}\n    </linearGradient>`
      : `    <pattern id="gold-texture" patternUnits="userSpaceOnUse" x="${textureOffsetX()}" y="${textureOffsetY()}" width="${(100 * textureScale()).toFixed(1)}" height="${(100 * textureScale()).toFixed(1)}">\n      <image href="/gold-textures/${selectedTexture()}" x="0" y="0" width="${(100 * textureScale()).toFixed(1)}" height="${(100 * textureScale()).toFixed(1)}" preserveAspectRatio="xMidYMid slice" style="filter: brightness(${textureBrightness()});" />\n    </pattern>`;

    const overlayGradDef = fillMode() === 'texture' && overlayOpacity() > 0
      ? `\n    <linearGradient id="gold-grad-overlay" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">\n${getGradientStopsString()}\n    </linearGradient>`
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
      <stop offset="89%" stop-color="#FBECA9" />
      <stop offset="100%" stop-color="#D5BB8A" />`;
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
          
          <div class="flex gap-2">
            <button 
              onClick={() => window.history.back()}
              class="px-4 py-2 text-xs font-mono border border-white/10 rounded bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-white/80"
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
                     <button 
                       onClick={() => setFillMode('texture')}
                       class={`py-0.5 text-[9.5px] font-mono rounded transition-all ${fillMode() === 'texture' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                     >
                       TEXTURE FILE
                     </button>
                   </div>
                 </div>

                 {/* Material Gradient Profiles or Texture Dropdown */}
                 <Show when={fillMode() === 'gradient'}>
                   <div class="mb-2.5">
                     <span class="text-[10px] text-white/50 block mb-1 uppercase tracking-wider">Material Gradient Scheme</span>
                     <div class="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded border border-white/5">
                        <button 
                          onClick={() => setGradientProfile('G')}
                          class={`py-0.5 px-1.5 text-[9.5px] font-mono rounded transition-all flex justify-between items-center gap-1 col-span-2 ${gradientProfile() === 'G' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                        >
                          <span>Opt G: Horizon Au (Reference match)</span>
                          <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#55411B] via-[#FFFDDA] to-[#FBECA9] shrink-0"></span>
                        </button>
                        <button 
                          onClick={() => setGradientProfile('A')}
                          class={`py-0.5 px-1.5 text-[9.5px] font-mono rounded transition-all flex justify-between items-center gap-1 ${gradientProfile() === 'A' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                        >
                          <span>Opt A: Shiny Au</span>
                          <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#FFF3C2] to-[#B28424] shrink-0"></span>
                        </button>
                        <button 
                           onClick={() => setGradientProfile('B')}
                           class={`py-0.5 px-1.5 text-[9.5px] font-mono rounded transition-all flex justify-between items-center gap-1 ${gradientProfile() === 'B' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                         >
                           <span>Opt B: Contrast Au</span>
                           <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#251502] via-[#FFF7C7] to-[#251502] shrink-0"></span>
                         </button>
                        <button 
                          onClick={() => setGradientProfile('C')}
                          class={`py-0.5 px-1.5 text-[9.5px] font-mono rounded transition-all flex justify-between items-center gap-1 ${gradientProfile() === 'C' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                        >
                          <span>Opt C: Antique Au</span>
                          <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#FFF2C2] via-[#A48748] to-[#EDCD75] shrink-0"></span>
                        </button>
                        <button 
                          onClick={() => setGradientProfile('D')}
                          class={`py-0.5 px-1.5 text-[9.5px] font-mono rounded transition-all flex justify-between items-center gap-1 ${gradientProfile() === 'D' ? 'bg-slate-500/20 text-slate-200 border border-slate-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                        >
                          <span>Opt D: Platinum Ag</span>
                          <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#EBEFF5] to-[#83878D] shrink-0"></span>
                        </button>
                        <button 
                          onClick={() => setGradientProfile('E')}
                          class={`py-0.5 px-1.5 text-[9.5px] font-mono rounded transition-all flex justify-between items-center gap-1 ${gradientProfile() === 'E' ? 'bg-slate-500/20 text-slate-200 border border-slate-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                        >
                          <span>Opt E: Steel Ag</span>
                          <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#D1D5DB] via-[#6B7280] to-[#374151] shrink-0"></span>
                        </button>
                        <button 
                          onClick={() => setGradientProfile('F')}
                          class={`py-0.5 px-1.5 text-[9.5px] font-mono rounded transition-all flex justify-between items-center gap-1 ${gradientProfile() === 'F' ? 'bg-slate-500/20 text-slate-200 border border-slate-500/30' : 'text-white/40 hover:text-white/70 border border-transparent bg-black/20 hover:bg-black/40'}`}
                        >
                          <span>Opt F: Obsidian Ag</span>
                          <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#9CA3AF] via-[#4B5563] to-[#111827] shrink-0"></span>
                        </button>
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

                {/* Glow Intensity Slider */}
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
                    const sizeColor = () => fillMode() === 'gradient' 
                      ? `url(#gold-grad-${type}-${size.replace('.', '_')})` 
                      : `url(#gold-pattern-${type}-${size.replace('.', '_')})`;
                    const sizeGradientColor = () => `url(#gold-grad-${type}-${size.replace('.', '_')})`;
                    return (
                      <div class="group/size relative flex flex-col items-center justify-end cursor-help pb-0.5">
                        <div class="bg-black/60 border border-white/5 hover:border-amber-500/40 hover:bg-black/80 rounded flex items-center justify-center overflow-hidden transition-all shadow-inner" style={{ width: `calc(${size} + 6px)`, height: `calc(${size} + 6px)` }}>
                           <svg viewBox="0 0 100 100" style={{ width: size, height: size, filter: `drop-shadow(0 0 ${glowIntensity()}px rgba(251, 191, 36, 0.45))` }}>
                            <defs>
                              <linearGradient id={`gold-grad-${type}-${size.replace('.', '_')}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                                <Show when={['1rem', '1.5rem', '2rem', '2.5rem'].includes(size)}>
                                  {/* OPTICAL SIZING: Smooth, high-contrast, double-ended gradients for small scales to prevent pixelation/dark reflection banding */}
                                  <Show when={['A', 'B', 'C', 'G'].includes(gradientProfile())}>
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
                                </Show>
                                <Show when={!['1rem', '1.5rem', '2rem', '2.5rem'].includes(size)}>
                                  {/* STANDARD DETAILED GRADIENTS FOR LARGER SIZES */}
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
                                    <stop offset="8%" stop-color="#997E47" />
                                    <stop offset="26%" stop-color="#B8A269" />
                                    <stop offset="30%" stop-color="#55411B" />
                                    <stop offset="34%" stop-color="#FFFDDA" />
                                    <stop offset="60%" stop-color="#D5BB8A" />
                                    <stop offset="81%" stop-color="#B8A269" />
                                    <stop offset="85%" stop-color="#55411B" />
                                    <stop offset="89%" stop-color="#FBECA9" />
                                    <stop offset="100%" stop-color="#D5BB8A" />
                                  </Show>
                                </Show>
                              </linearGradient>
                              <pattern id={`gold-pattern-${type}-${size.replace('.', '_')}`} patternUnits="userSpaceOnUse" x={textureOffsetX()} y={textureOffsetY()} width={100 * textureScale()} height={100 * textureScale()}>
                                <image href={`/gold-textures/${selectedTexture()}`} x="0" y="0" width={100 * textureScale()} height={100 * textureScale()} preserveAspectRatio="xMidYMid slice" style={{ filter: `brightness(${textureBrightness()}) contrast(${textureContrast()}) saturate(${textureSaturation()})` }} />
                              </pattern>
                              <clipPath id={`k-horizontal-clip-${type}-${size.replace('.', '_')}`}>
                                <rect x="10" y={c().clipY} width="80" height={c().clipHeight} />
                              </clipPath>
                            </defs>
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
                            <g clip-path={`url(#k-horizontal-clip-${type}-${size.replace('.', '_')})`}>
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
                            <g clip-path={`url(#k-horizontal-clip-${type}-${size.replace('.', '_')})`}>
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
                            <g clip-path={`url(#k-horizontal-clip-${type}-${size.replace('.', '_')})`}>
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
                              <g clip-path={`url(#k-horizontal-clip-${type}-${size.replace('.', '_')})`}>
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
                    <div class="p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all flex flex-col items-center">
                      <div class="text-center mb-3">
                        <span class="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">{type === 'medium' ? 'Active Config' : `${type} view`}</span>
                        <span class="text-[10px] text-white/40 block mt-0.5">Border: {borderStrokeWidth()}px | K: {currentKStrokeWidth()}px</span>
                      </div>
                      
                      {/* SVG Render box */}
                      <div class="w-40 h-40 bg-black/50 border border-white/10 rounded-lg flex items-center justify-center relative group overflow-hidden shadow-inner mb-3">
                        <div class="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        <svg viewBox="0 0 100 100" class="w-28 h-28" style={{ filter: `drop-shadow(0 0 ${glowIntensity()}px rgba(251, 191, 36, 0.45))` }}>
                          <defs>
                            {/* Linear Gradient with userSpaceOnUse to resolve zero-width bounding box bugs */}
                            <linearGradient id={`gold-grad-${type}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
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
                            </linearGradient>

                            <pattern id={`gold-pattern-${type}`} patternUnits="userSpaceOnUse" x={textureOffsetX()} y={textureOffsetY()} width={100 * textureScale()} height={100 * textureScale()}>
                              <image href={`/gold-textures/${selectedTexture()}`} x="0" y="0" width={100 * textureScale()} height={100 * textureScale()} preserveAspectRatio="xMidYMid slice" style={{ filter: `brightness(${textureBrightness()}) contrast(${textureContrast()}) saturate(${textureSaturation()})` }} />
                            </pattern>

                            {/* Horizontal clip path to cut diagonal stroke extensions perfectly flat */}
                            <clipPath id={`k-horizontal-clip-${type}`}>
                              <rect x="10" y={c().clipY} width="80" height={c().clipHeight} />
                            </clipPath>
                          </defs>

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

      </div>
    </main>
  );
};
