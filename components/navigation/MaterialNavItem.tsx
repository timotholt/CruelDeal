import { JSX } from 'solid-js';
import { GameText } from '../ui/GameText';
import {
  MaterialButton,
  materialRecipeToInteractiveSurfaceProps,
  materialRecipeToSurfaceProps,
  type MaterialRecipe,
  type MaterialRecipeState,
} from '../ui/material-lab';

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
          baseFontSize={0.75}
          minScale={0.4}
          maxScale={1}
          skewFactor={0.9}
          maxLines={1}
          italic={resolved().fontStyle === 'italic'}
          letterSpacing="var(--content-letter-spacing)"
          class="cd-nav-item__game-text"
        />
      </span>
    </MaterialButton>
  );
};
