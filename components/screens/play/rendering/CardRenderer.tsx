import type { JSX } from 'solid-js';
import { CardSurface } from '@/components/game-surfaces/card/CardSurface';
import type { CardSurfaceModel } from '@/components/game-surfaces/contracts';

interface CardRendererProps {
  readonly model: CardSurfaceModel;
}

/**
 * The only play-card painter. It always lays out at the inspector-sized
 * 500x700 coordinate system; the SVG viewport scales that finished visual for
 * hand, lane, pile, inspector, and motion surfaces without relaying out text.
 */
export const CardRenderer = (props: CardRendererProps): JSX.Element => {
  return <CardSurface model={props.model} />;
};
