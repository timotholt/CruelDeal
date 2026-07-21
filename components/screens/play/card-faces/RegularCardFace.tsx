import type { CardFaceModel } from './cardFaceModel';
import { CardName } from './CardName';

interface RegularCardFaceProps {
  readonly card: CardFaceModel;
  readonly variant: 'play' | 'pile';
}

export const RegularCardFace = (props: RegularCardFaceProps) => {
  const playFace = () => (
    <>
      <div class={'cost ' + props.card.costTone}>{props.card.cost}</div>
      <div class={'power ' + props.card.powerTone}>{props.card.power}</div>
      {props.card.portraitPath ? (
        <img class="portrait" src={props.card.portraitPath} alt="" aria-hidden="true" />
      ) : (
        <div class="bar" style={{ background: props.card.art }} />
      )}
      <CardName name={props.card.name} class="name card-name" />
      {props.card.textDisabled ? <div class="text-disabled-mark" aria-hidden="true" /> : null}
    </>
  );

  const pileFace = () => (
    <div class="pile-card pile-card--regular" data-card-type={props.card.type}>
      <div class="pile-card__badges">
        <span class="pile-card__cost">{props.card.cost}</span>
        <span class="pile-card__power">{props.card.power}</span>
      </div>
      <CardName name={props.card.name} class="pile-card__name" />
    </div>
  );

  return props.variant === 'play' ? playFace() : pileFace();
};
