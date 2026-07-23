import {
  Show,
  untrack,
  type JSX,
} from 'solid-js';

interface ReactiveIdentityBoundaryProps {
  readonly identity: unknown;
  readonly render: () => JSX.Element;
}

/**
 * Owns a rendered subtree by an explicit identity and prevents reactive reads
 * inside that subtree from leaking into the parent insertion computation.
 *
 * Solid's control-flow components can return nested accessors. If an outer
 * insertion unwraps those accessors itself, it can accidentally subscribe to
 * every signal read while resolving the child tree. For a route surface that
 * means an ordinary game-frame update can remove and reinsert the whole route.
 * This boundary invokes an explicit render factory without dependency
 * tracking. Solid's keyed control-flow owner disposes the old route tree and
 * creates a new one only when `identity` changes; ordinary descendant signal
 * updates remain owned by the existing route tree.
 */
export const ReactiveIdentityBoundary = (
  props: ReactiveIdentityBoundaryProps,
): JSX.Element => (
  <div style={{ display: 'contents' }} data-reactive-identity-boundary>
    <Show when={props.identity} keyed>
      {(_identity) => untrack(props.render)}
    </Show>
  </div>
);
