import { GameTextV3 } from '@/components/ui/GameTextV3';

interface CardNameProps {
  readonly name: string;
  readonly class: string;
  readonly baseFontSize?: number | string;
}

/** The only card-name painter. Every surface gets the same V3 fit contract. */
export const CardName = (props: CardNameProps) => (
  <GameTextV3
    text={props.name}
    class={props.class}
    baseFontSize={props.baseFontSize ?? 1.05}
    fitMode="paragraph"
    maxLines={3}
    minScale={0.48}
    align="center"
    verticalAlign="center"
    textStyle={{
      fontFamily: '"Unica One", sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
      letterSpacing: '0.04em',
      lineHeight: 0.96,
      textTransform: 'uppercase',
    }}
  />
);
