interface EnergyBadgeProps {
  value: number;
  title?: string;
}

export const EnergyBadge = (props: EnergyBadgeProps) => {
  return (
    <div class="energy-badge" title={props.title ?? `Energy ${props.value}`}>
      <span class="energy-badge__value">{props.value}</span>
      <svg
        class="energy-badge__bolt"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <path d="M9.8 1 3.7 8.1h3L5.9 15l6.4-7.4H9.1L9.8 1Z" />
      </svg>
    </div>
  );
};
