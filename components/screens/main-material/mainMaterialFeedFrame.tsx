import { createContext, createEffect, JSX, onCleanup, useContext } from 'solid-js';
import {
  feedNodeLayoutCss,
  resolveLayoutDirection,
  resolveLayoutHMode,
  resolveLayoutWMode,
} from './feedNodeLayoutCss';
import type { PreviewTargetRole } from './mainMaterialInteractionModel';
import type { FeedCardNode } from './mainMaterialFeedModel';

export interface CssEmissionProbe {
  targetId: string | null;
  disabledKeys: ReadonlySet<string>;
}

export interface MainMaterialDomRegistration {
  createInstanceId: () => string;
  register: (targetId: string, instanceId: string, element: HTMLElement) => void;
  unregister: (instanceId: string) => void;
}

let fallbackInstanceId = 0;
const fallbackDomRegistration: MainMaterialDomRegistration = {
  createInstanceId: () => `main-material-frame-${fallbackInstanceId += 1}`,
  register: () => undefined,
  unregister: () => undefined,
};

const DomRegistrationContext = createContext<MainMaterialDomRegistration>(fallbackDomRegistration);

export const MainMaterialDomRegistrationProvider = (props: {
  registration: MainMaterialDomRegistration;
  children: JSX.Element;
}) => (
  <DomRegistrationContext.Provider value={props.registration}>
    {props.children}
  </DomRegistrationContext.Provider>
);

const useDomRegistration = () => useContext(DomRegistrationContext);

export const FeedNodeFrame = (props: {
  node: FeedCardNode;
  targetId: string;
  role: PreviewTargetRole;
  targetClass: string;
  children: JSX.Element;
  ariaLabel?: string;
  cssProbe?: CssEmissionProbe;
  style?: JSX.CSSProperties;
  onPointerDown?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
  onPointerMove?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
  onPointerUp?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
  onPointerCancel?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
  onPointerLeave?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
}) => {
  const domRegistration = useDomRegistration();
  const materialInstanceId = domRegistration.createInstanceId();
  let frameElement: HTMLDivElement | undefined;
  createEffect(() => {
    const targetId = props.targetId;
    if (frameElement) domRegistration.register(targetId, materialInstanceId, frameElement);
  });
  onCleanup(() => domRegistration.unregister(materialInstanceId));
  const layoutStyle = () => {
    const css = {
      ...feedNodeLayoutCss(props.node.layout, { forcePaddingVar: props.node.type === 'button' }),
    };
    if (props.cssProbe?.targetId === props.targetId) {
      props.cssProbe.disabledKeys.forEach((key) => {
        delete (css as Record<string, unknown>)[key];
      });
    }
    return { ...css, ...props.style };
  };
  return (
    <div
      ref={(element) => {
        frameElement = element;
        domRegistration.register(props.targetId, materialInstanceId, element);
      }}
      class={`main-material-card-node main-material-card-node--${props.node.type}-frame ${props.targetClass}`}
      aria-label={props.ariaLabel}
      data-feed-layout-mode={props.node.layout.mode}
      data-feed-layout-slot={props.node.layout.slot}
      data-w-mode={resolveLayoutWMode(props.node.layout)}
      data-h-mode={resolveLayoutHMode(props.node.layout)}
      data-direction={resolveLayoutDirection(props.node.layout)}
      data-wrap={props.node.layout.wrap ? 'true' : undefined}
      data-material-target-id={props.targetId}
      data-material-instance-id={materialInstanceId}
      data-material-role={props.role}
      data-css-probe-target={props.cssProbe?.targetId === props.targetId ? 'true' : undefined}
      style={layoutStyle()}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      onPointerLeave={props.onPointerLeave}
    >
      {props.children}
    </div>
  );
};

export const MaterialDomRegistryTarget = (props: {
  targetId: string;
  role: PreviewTargetRole;
  class?: string;
  children: JSX.Element;
}) => {
  const domRegistration = useDomRegistration();
  const materialInstanceId = domRegistration.createInstanceId();
  let elementRef: HTMLDivElement | undefined;
  createEffect(() => {
    const targetId = props.targetId;
    if (elementRef) domRegistration.register(targetId, materialInstanceId, elementRef);
  });
  onCleanup(() => domRegistration.unregister(materialInstanceId));

  return (
    <div
      ref={(element) => {
        elementRef = element;
        domRegistration.register(props.targetId, materialInstanceId, element);
      }}
      class={props.class}
      data-material-target-id={props.targetId}
      data-material-instance-id={materialInstanceId}
      data-material-role={props.role}
    >
      {props.children}
    </div>
  );
};
