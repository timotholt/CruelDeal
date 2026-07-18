import type { Rng } from '../engine/rng';

export const PLAYGAME_RNG_NAMESPACE_VERSION = 1 as const;

export type PlaygameRngNamespace = 'bootstrap' | 'resolution' | 'ai' | 'cosmetic';

declare const rngNamespaceBrand: unique symbol;

/** Rng fork branded with the subsystem that owns its draws. */
export type NamespacedRng<Namespace extends PlaygameRngNamespace> = Rng & {
  readonly [rngNamespaceBrand]: Namespace;
};

function namespaceTag(namespace: PlaygameRngNamespace): string {
  return `playgame:v${PLAYGAME_RNG_NAMESPACE_VERSION}:${namespace}`;
}

/** Typed top-level helper over the existing order-independent Rng.fork. */
export function forkPlaygameRng<Namespace extends PlaygameRngNamespace>(
  root: Rng,
  namespace: Namespace,
): NamespacedRng<Namespace> {
  return root.fork(namespaceTag(namespace)) as NamespacedRng<Namespace>;
}

export const forkBootstrapRng = (root: Rng): NamespacedRng<'bootstrap'> =>
  forkPlaygameRng(root, 'bootstrap');

export const forkResolutionRng = (root: Rng): NamespacedRng<'resolution'> =>
  forkPlaygameRng(root, 'resolution');

export const forkAiRng = (root: Rng): NamespacedRng<'ai'> =>
  forkPlaygameRng(root, 'ai');

export const forkCosmeticRng = (root: Rng): NamespacedRng<'cosmetic'> =>
  forkPlaygameRng(root, 'cosmetic');

/**
 * Derive a stable semantic child (for example a transaction ID) without
 * coupling sibling fork creation or draw order. Callers own identity format.
 */
export function forkSemanticRng<Namespace extends PlaygameRngNamespace>(
  parent: NamespacedRng<Namespace>,
  semanticIdentity: string,
): NamespacedRng<Namespace> {
  return parent.fork(`semantic:${semanticIdentity}`) as NamespacedRng<Namespace>;
}
