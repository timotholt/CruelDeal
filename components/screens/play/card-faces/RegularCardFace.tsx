import type { CardRenderModel } from '../rendering/renderModels';
import { CardName } from './CardName';

interface RegularCardFaceProps {
  readonly card: CardRenderModel;
}

export const RegularCardFace = (props: RegularCardFaceProps) => {
  return (
    <>
      <div class={'cost ' + props.card.costTone}>{props.card.cost}</div>
      <div class={'power ' + props.card.powerTone}>{props.card.power}</div>
      {props.card.portraitPath ? (
        <img class="portrait" src={props.card.portraitPath} alt="" aria-hidden="true" />
      ) : (
        <div class="bar" style={{ background: props.card.art }} />
      )}
      <CardName name={props.card.name} class="name card-name" baseFontSize="100px" />
      {props.card.textDisabled ? <div class="text-disabled-mark" aria-hidden="true" /> : null}
    </>
  );
};
