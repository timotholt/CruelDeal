import { JSX } from 'solid-js';
import { MaterialNavItem } from './MaterialNavItem';
import { navTabMaterialRecipe } from '../ui/material-lab/materialPresets';

interface NavItemProps {
  label: string;
  icon: JSX.Element;
  active: boolean;
  onClick: () => void;
}

export const NavItem = (props: NavItemProps) => (
  <MaterialNavItem
    label={props.label}
    icon={props.icon}
    active={props.active}
    recipe={navTabMaterialRecipe}
    onClick={props.onClick}
    class="flex-1"
  />
);
