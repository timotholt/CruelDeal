import type { CardFaceModel } from './cardFaceModel';
import { CardName } from './CardName';

interface SpellCardFaceProps {
  readonly card: CardFaceModel;
  readonly variant: 'play' | 'pile';
}

export const SpellCardFace = (props: SpellCardFaceProps) => {
  const playFace = () => (
    <>
      <div class="spell-card__base" aria-hidden="true" />
      <div class="spell-card-surface">
        <div class={'cost ' + props.card.costTone}>{props.card.cost}</div>
        <div class="spell-card__sigil" aria-hidden="true">✦</div>
        <CardName
          name={props.card.name}
          class="name card-name spell-card__name"
          baseFontSize="62.5cqw"
        />
        {props.card.textDisabled ? <div class="text-disabled-mark" aria-hidden="true" /> : null}
      </div>
    </>
  );

  const pileFace = () => (
    <div class="pile-card pile-card--spell" data-card-type="spell">
      <span class="pile-card__cost">{props.card.cost}</span>
      <div class="spell-card__sigil" aria-hidden="true">✦</div>
      <CardName name={props.card.name} class="pile-card__name" />
    </div>
  );

  return <>{props.variant === 'play' ? playFace() : pileFace()}</>;
};
