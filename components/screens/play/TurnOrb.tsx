interface TurnOrbProps {
  turn: number;
}

export const TurnOrb = (props: TurnOrbProps) => {
  return (
    <div class="turn-orb" aria-label={`Turn ${props.turn}`}>
      <span class="turn-orb__label">Turn</span>
      <span class="turn-orb__value">{props.turn}</span>
    </div>
  );
};
