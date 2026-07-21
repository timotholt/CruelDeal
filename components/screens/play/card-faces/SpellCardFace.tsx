import type { CardRenderModel } from '../rendering/renderModels';
import { CardName } from './CardName';

interface SpellCardFaceProps {
  readonly card: CardRenderModel;
}

export const SpellCardFace = (props: SpellCardFaceProps) => {
  return (
    <>
      <div class="spell-card__base" aria-hidden="true" />
      <div class="spell-card-surface">
        <div class={'cost ' + props.card.costTone}>{props.card.cost}</div>
        <div class="spell-card__sigil" aria-hidden="true">✦</div>
        <CardName
          name={props.card.name}
          class="name card-name spell-card__name"
          baseFontSize="125px"
        />
        {props.card.textDisabled ? <div class="text-disabled-mark" aria-hidden="true" /> : null}
      </div>
    </>
  );
};
