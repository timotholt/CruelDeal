import type { SeatPresentationBlock } from '../runtime/projection';
import type { MatchPresentationSink } from './presentationDirector';

export interface OpeningPresentationOptions {
  readonly block: SeatPresentationBlock;
  readonly sink: MatchPresentationSink;
  readonly presentOpening: (block: SeatPresentationBlock) => void;
  readonly bindPresentationSink: (sink: MatchPresentationSink) => () => void;
}

export interface OpeningPresentation {
  dispose(): void;
}

/**
 * Connects the opening committed block to the canonical director. The sink's
 * prepared transaction owner supplies the compiled prelude; this lifecycle
 * function intentionally contains no animation pacing of its own.
 */
export function startOpeningPresentation(
  options: OpeningPresentationOptions,
): OpeningPresentation {
  let disposed = false;
  const unbindPresentationSink = options.bindPresentationSink(options.sink);
  options.presentOpening(options.block);

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unbindPresentationSink();
    },
  };
}
