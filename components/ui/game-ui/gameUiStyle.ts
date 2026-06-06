import type { JSX } from 'solid-js';
import { computeSurfaceStateVars } from '../material-lab/surfaceStateVars';
import type { SurfaceOptions } from '../material-lab/surfaceSchema';
import type { GameSurfaceRecipe, GameTextStyle, GameUiTheme } from './gameUiThemeSchema';

const textTone = (theme: GameUiTheme, tone: GameTextStyle['tone']) => {
  if (!tone || tone === 'inherit') return undefined;
  return theme.palette[tone];
};

export const gameTextStyleToCss = (
  theme: GameUiTheme,
  style: GameTextStyle,
): JSX.CSSProperties => {
  const font = style.font ? theme.typography[style.font] : undefined;
  return {
    ...(textTone(theme, style.tone) ? { color: textTone(theme, style.tone) } : {}),
    ...(font?.family ? { 'font-family': font.family } : {}),
    ...(style.sizeRem !== undefined ? { 'font-size': `${style.sizeRem}rem` } : {}),
    ...(style.weight !== undefined || font?.weight !== undefined ? { 'font-weight': `${style.weight ?? font?.weight}` } : {}),
    ...(style.lineHeight !== undefined || font?.lineHeight !== undefined ? { 'line-height': `${style.lineHeight ?? font?.lineHeight}` } : {}),
    ...(style.letterSpacing !== undefined || font?.letterSpacing !== undefined ? { 'letter-spacing': `${style.letterSpacing ?? font?.letterSpacing}em` } : {}),
    ...(style.transform ? { 'text-transform': style.transform } : {}),
    ...(style.opacity !== undefined ? { opacity: `${style.opacity / 100}` } : {}),
  } as JSX.CSSProperties;
};

export const surfacePropsForGameRecipe = (recipe: GameSurfaceRecipe): SurfaceOptions => {
  const stateVars = computeSurfaceStateVars(recipe.surface, recipe.states);
  return {
    ...recipe.surface,
    stateVars: Object.keys(stateVars).length ? stateVars : recipe.surface.stateVars,
  };
};
