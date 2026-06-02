import { children, JSX, Match, Switch } from 'solid-js';
import { MaterialButton, MaterialPanel, type ButtonSize } from './MaterialPrimitives';

export type MaterialSurfaceHostKind = 'button' | 'panel' | 'bare';

export const MaterialSurfaceHost = (props: {
  kind: MaterialSurfaceHostKind;
  surfaceProps?: Record<string, any>;
  class?: string;
  buttonSize?: ButtonSize;
  buttonFullWidth?: boolean;
  buttonType?: JSX.ButtonHTMLAttributes<HTMLButtonElement>['type'];
  label?: JSX.Element;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
  padded?: boolean;
  children?: JSX.Element;
}) => {
  const resolvedChildren = children(() => props.children);

  return (
    <Switch>
      <Match when={props.kind === 'button'}>
        <MaterialButton
          {...props.surfaceProps}
          type={props.buttonType ?? 'button'}
          size={props.buttonSize}
          fullWidth={props.buttonFullWidth ?? false}
          class={props.class}
          onClick={props.onClick}
          label={props.label ?? resolvedChildren()}
        />
      </Match>
      <Match when={props.kind === 'panel'}>
        <MaterialPanel
          {...props.surfaceProps}
          padded={props.padded ?? false}
          class={props.class}
        >
          {resolvedChildren()}
        </MaterialPanel>
      </Match>
      <Match when={true}>
        {resolvedChildren()}
      </Match>
    </Switch>
  );
};
