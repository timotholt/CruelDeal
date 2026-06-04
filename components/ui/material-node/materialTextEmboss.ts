export type MaterialTextTone = 'none' | 'inherit' | 'black' | 'white' | 'muted' | 'gray' | 'brass' | 'gold' | 'cyan' | 'red' | 'green';
export type MaterialTextEmbossMode = 'none' | 'dark' | 'light' | 'shadow';

export interface MaterialTextEmbossStyle {
  contentTone?: MaterialTextTone;
  textEmbossMode?: MaterialTextEmbossMode;
  textEmbossStrength?: number;
  textEmbossOffset?: number;
  textEmbossBlur?: number;
}

export const materialTextEmbossShadow = (style: MaterialTextEmbossStyle) => {
  if (style.textEmbossMode === 'none' || (style.textEmbossStrength ?? 0) <= 0) return 'none';
  const s = Math.max(0, Math.min(100, style.textEmbossStrength ?? 0)) / 100;
  const off = 1 + Math.round(2 * s);
  const blur = Math.round(6 * s);
  if (style.textEmbossMode === 'shadow') {
    const dist = Math.round((style.textEmbossOffset ?? 50) / 100 * 16);
    const dx = Math.round(dist * 0.7);
    const dy = dist;
    const blurAmt = Math.round((style.textEmbossBlur ?? 50) / 100 * 16);
    const isDarkText = style.contentTone === 'black' || style.contentTone === 'muted' || style.contentTone === 'none' || style.contentTone === 'inherit';
    const shadowRgb = isDarkText ? '255 255 255' : '0 0 0';
    const opacityMultiplier = isDarkText ? 0.65 : 0.9;

    return [
      `${dx}px ${dy}px ${blurAmt}px rgb(${shadowRgb} / ${opacityMultiplier * s})`,
      `${Math.round(dx * 0.55)}px ${Math.round(dy * 0.55)}px ${Math.max(1, Math.round(blurAmt * 0.6))}px rgb(${shadowRgb} / ${opacityMultiplier * 0.7 * s})`,
    ].join(', ');
  }
  if (style.textEmbossMode === 'light') {
    return [
      `0 -${off}px 0 rgb(255 255 255 / ${0.85 * s})`,
      `0 ${off}px 0 rgb(0 0 0 / ${0.55 * s})`,
      `0 ${off}px ${blur + 1}px rgb(0 0 0 / ${0.4 * s})`,
    ].join(', ');
  }
  return [
    `0 ${off}px 0 rgb(0 0 0 / ${0.9 * s})`,
    `0 ${off}px ${blur + 2}px rgb(0 0 0 / ${0.5 * s})`,
    `0 -1px 0 rgb(255 255 255 / ${0.3 * s})`,
  ].join(', ');
};
