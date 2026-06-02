import { JSX } from 'solid-js';
import type { MaterialNodeRecipe, MaterialNodeRole } from './MaterialNodeTypes';

const layoutStyle = (node: MaterialNodeRecipe): JSX.CSSProperties | undefined => {
  const layout = node.layout;
  if (!layout) return undefined;
  return {
    ...(layout.style ?? {}),
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
  } as JSX.CSSProperties;
};

export const MaterialNodeFrame = (props: {
  node: MaterialNodeRecipe;
  role: MaterialNodeRole;
  targetId: string;
  class?: string;
  children: JSX.Element;
}) => (
  <div
    class={props.class}
    data-material-node-id={props.node.id}
    data-material-target-id={props.targetId}
    data-material-role={props.role}
    style={layoutStyle(props.node)}
  >
    {props.children}
  </div>
);
