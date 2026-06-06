import { children, JSX } from 'solid-js';
import { MaterialButton, MaterialPanel, type ButtonSize } from './MaterialPrimitives';
import type { IconPosition } from './surfaceSchema';
import type { SurfaceOptions } from './surfaceSchema';

export type MaterialSurfaceHostKind = 'button' | 'panel' | 'bare';

interface MaterialSurfaceHostBaseProps {
  surfaceProps?: SurfaceOptions;
  class?: string;
  children?: JSX.Element;
}

export interface MaterialSurfaceHostButtonProps extends MaterialSurfaceHostBaseProps {
  kind: 'button';
  buttonSize?: ButtonSize;
  buttonFullWidth?: boolean;
  buttonType?: JSX.ButtonHTMLAttributes<HTMLButtonElement>['type'];
  icon?: JSX.Element;
  iconRight?: JSX.Element;
  iconPosition?: IconPosition;
  label?: JSX.Element;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
}

export interface MaterialSurfaceHostPanelProps extends MaterialSurfaceHostBaseProps {
  kind: 'panel';
  padded?: boolean;
}

export interface MaterialSurfaceHostBareProps {
  kind: 'bare';
  children?: JSX.Element;
}

export type MaterialSurfaceHostProps =
  | MaterialSurfaceHostButtonProps
  | MaterialSurfaceHostPanelProps
  | MaterialSurfaceHostBareProps;

export const MaterialSurfaceHost = (props: MaterialSurfaceHostProps) => {
  const resolvedChildren = children(() => props.children);

  if (props.kind === 'button') {
    return (
      <MaterialButton
        {...props.surfaceProps}
        type={props.buttonType ?? 'button'}
        size={props.buttonSize}
        fullWidth={props.buttonFullWidth ?? false}
        icon={props.icon}
        iconRight={props.iconRight}
        iconPosition={props.iconPosition}
        class={props.class}
        onClick={props.onClick}
        label={props.label ?? resolvedChildren()}
      />
    );
  }

  if (props.kind === 'panel') {
    return (
      <MaterialPanel
        {...props.surfaceProps}
        padded={props.padded ?? false}
        class={props.class}
      >
        {resolvedChildren()}
      </MaterialPanel>
    );
  }

  return resolvedChildren();
};
