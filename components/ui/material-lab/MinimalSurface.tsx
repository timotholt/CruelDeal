import { JSX, Show } from 'solid-js';
import '../../../src/styles/material-minimal.css';
import { surfaceClass, surfaceEmissionAttrs, surfaceStyle } from './surfaceFeatures';
import { minimalSurfaceChildren, minimalSurfaceVars } from './minimalSurfaceCss';
import type { SurfaceOptions } from './surfaceSchema';

// Minimal 3-element material surface (docs/surface-emitter-rewrite-spec.md).
//
// Root keeps the `cd-surface` class (via surfaceClass) so the existing var system,
// shape/bevel, state var-swap machinery, focus/disabled, and root brightness all apply
// unchanged — only the decorative structure differs: instead of ~10 layer spans, one
// fill child (base/texture/tint/gradient/glass as a fixed background stack + glass
// pseudos), one lighting child (border/edges/corners + glow/emission pseudos), an
// optional edge-wear child (own mask), and the content host. Children render
// active-effects-only.
export const MinimalSurface = (props: {
  surfaceProps?: SurfaceOptions;
  class?: string;
  style?: JSX.CSSProperties;
  rootProps?: JSX.HTMLAttributes<HTMLDivElement>;
  // 'label' applies the button-label typography (content vars); default is neutral flow.
  contentMode?: 'flow' | 'label';
  children?: JSX.Element;
}) => {
  const options = () => props.surfaceProps ?? {};
  const parts = () => minimalSurfaceChildren(options());

  return (
    <div
      {...(props.rootProps || {})}
      {...surfaceEmissionAttrs(options())}
      class={surfaceClass(options(), `cd-surface--minimal ${props.class || ''}`)}
      style={{
        ...surfaceStyle(options()),
        ...minimalSurfaceVars(options()),
        ...(props.style || {}),
        ...(typeof props.rootProps?.style === 'object' ? props.rootProps.style : {}),
      }}
    >
      <Show when={parts().fill}>
        <span class="cdm__fill" aria-hidden="true" />
      </Show>
      <Show when={parts().light}>
        <span class="cdm__light" aria-hidden="true" />
      </Show>
      <Show when={parts().wear}>
        <span class="cdm__wear" aria-hidden="true" />
      </Show>
      <div class={`cdm__content ${props.contentMode === 'label' ? 'cdm__content--label' : ''}`}>
        {props.children}
      </div>
    </div>
  );
};
