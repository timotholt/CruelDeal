import { JSX } from 'solid-js';
import { GameTextV3 as GameText } from '../ui/GameTextV3';
import {
  materialRecipeToInteractiveSurfaceProps,
  materialRecipeToSurfaceProps,
} from '../ui/material-lab/MaterialRecipeCompiler';
import { MaterialButton } from '../ui/material-lab/MaterialPrimitives';
import type {
  MaterialRecipe,
  MaterialRecipeState,
} from '../ui/material-lab/MaterialRecipeTypes';

interface MaterialNavItemProps {
  label: string;
  icon: JSX.Element;
  active: boolean;
  recipe: MaterialRecipe;
  onClick: () => void;
  class?: string;
  visualState?: MaterialRecipeState;
}

export const MaterialNavItem = (props: MaterialNavItemProps) => {
  const visualState = () => props.visualState || (props.active ? 'active' : 'rest');
  const resolved = () => materialRecipeToSurfaceProps(props.recipe, visualState());
  const surfaceProps = () => visualState() === 'hover'
    ? materialRecipeToSurfaceProps(props.recipe, 'hover')
    : materialRecipeToInteractiveSurfaceProps(props.recipe, visualState() as 'rest' | 'active' | 'pressed');

  return (
    <MaterialButton
      {...surfaceProps()}
      size="sm"
      iconPosition="top"
      class={`cd-nav-item ${props.active ? 'is-active' : ''} ${props.class || ''}`}
      onClick={props.onClick}
      icon={props.icon}
    >
      <span class="cd-nav-item__label">
        <GameText
          text={props.label}
          baseFontSize={resolved().textSizeRem ?? 0.75}
          minScale={0.4}
          maxScale={1}
          skewFactor={0.9}
          maxLines={1}
          textStyle={{
            fontStyle: resolved().fontStyle === 'italic' ? 'italic' : 'normal',
            letterSpacing: 'var(--content-letter-spacing)',
          }}
          class="cd-nav-item__game-text"
        />
      </span>
    </MaterialButton>
  );
};
