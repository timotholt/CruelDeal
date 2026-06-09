import { createContext, createEffect, JSX, onCleanup, useContext } from 'solid-js';
import type { MaterialNodeRecipe, MaterialNodeRole } from './MaterialNodeTypes';

/**
 * Optional DOM-registration hook. A host (e.g. the material editor) can provide a
 * registration so it can find mounted node elements by target id for live-DOM export
 * and inspection. Default is a no-op: `createInstanceId` returns '' so registration is
 * skipped and standalone consumers render exactly as before.
 */
export interface MaterialNodeDomRegistration {
  createInstanceId: () => string;
  register: (targetId: string, instanceId: string, element: HTMLElement) => void;
  unregister: (instanceId: string) => void;
}

const noopRegistration: MaterialNodeDomRegistration = {
  createInstanceId: () => '',
  register: () => undefined,
  unregister: () => undefined,
};

const MaterialNodeDomRegistrationContext = createContext<MaterialNodeDomRegistration>(noopRegistration);

export const MaterialNodeDomRegistrationProvider = (props: {
  registration: MaterialNodeDomRegistration;
  children: JSX.Element;
}) => (
  <MaterialNodeDomRegistrationContext.Provider value={props.registration}>
    {props.children}
  </MaterialNodeDomRegistrationContext.Provider>
);

const layoutStyle = (node: MaterialNodeRecipe): JSX.CSSProperties | undefined => {
  const layout = node.layout;
  if (!layout) return undefined;
  // Explicit layout fields override the baked `style`, but only when defined — an
  // undefined explicit field must NOT clobber a value already present in `style`
  // (e.g. a node that carries position/size purely via `layout.style`).
  const explicit: Record<string, string | undefined> = {
    display: layout.display,
    'flex-direction': layout.direction,
    'align-items': layout.align,
    'justify-content': layout.justify,
    gap: layout.gap === undefined ? undefined : `${layout.gap}px`,
    padding: layout.padding === undefined ? undefined : `${layout.padding}px`,
    width: layout.width,
    height: layout.height,
    'min-width': layout.minWidth,
    'min-height': layout.minHeight,
    left: layout.position?.left,
    right: layout.position?.right,
    top: layout.position?.top,
    bottom: layout.position?.bottom,
    inset: layout.position?.inset,
  };
  const defined = Object.fromEntries(Object.entries(explicit).filter(([, v]) => v !== undefined));
  return { ...(layout.style ?? {}), ...defined } as JSX.CSSProperties;
};

export const MaterialNodeFrame = (props: {
  node: MaterialNodeRecipe;
  role: MaterialNodeRole;
  targetId: string;
  class?: string;
  children: JSX.Element;
}) => {
  const registration = useContext(MaterialNodeDomRegistrationContext);
  const instanceId = registration.createInstanceId();
  let element: HTMLDivElement | undefined;

  if (instanceId) {
    createEffect(() => {
      if (element) registration.register(props.targetId, instanceId, element);
    });
    onCleanup(() => registration.unregister(instanceId));
  }

  return (
    <div
      ref={element}
      class={props.class}
      data-material-node-id={props.node.id}
      data-material-target-id={props.targetId}
      data-material-role={props.role}
      style={layoutStyle(props.node)}
    >
      {props.children}
    </div>
  );
};
