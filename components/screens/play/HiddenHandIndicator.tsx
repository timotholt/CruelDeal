interface HiddenHandIndicatorProps {
  count: number;
}

export const HiddenHandIndicator = (props: HiddenHandIndicatorProps) => {
  const visibleBacks = () => Math.min(3, props.count);

  return (
    <div class="hidden-hand" aria-label={`Opponent hand size ${props.count}`} title={`Hand ${props.count}`}>
      <div class="hidden-hand__backs">
        {Array.from({ length: visibleBacks() }).map((_, index) => (
          <span
            class="hidden-hand__back"
            style={{
              transform: `translateX(${index * 9}px) rotate(${(index - 1) * 5}deg)`,
              'z-index': String(index + 1),
            }}
          />
        ))}
      </div>
      <span class="hidden-hand__count">{props.count}</span>
    </div>
  );
};
