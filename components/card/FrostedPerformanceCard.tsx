import './FrostedPerformanceCard.css';

export interface FrostedPerformanceCardProps {
  artUrl?: string;
  name?: string;
  subtitle?: string;
  cost?: number | string;
  power?: number | string;
  footer?: string;
}

const DEFAULT_ART = '/prototypes/card-concept/v1/a9876b68-6572-47aa-b8f3-692d8a9a557a.png';

export const FrostedPerformanceCard = (props: FrostedPerformanceCardProps) => {
  return (
    <article class="frosted-card" aria-label={`${props.name ?? 'Lyria'} performance card`}>
      <div class="frosted-card__art-shell">
        <img class="frosted-card__art" src={props.artUrl ?? DEFAULT_ART} alt="" />
      </div>
      <div class="frosted-card__faceplate" aria-hidden="true" />

      <div class="frosted-card__title">
        <div class="frosted-card__name">{props.name ?? 'LYRIA'}</div>
        <div class="frosted-card__subtitle">{props.subtitle ?? 'SONIC SIREN'}</div>
      </div>

      <div class="frosted-card__stat frosted-card__stat--left">
        <div class="frosted-card__stat-value">{props.cost ?? 5}</div>
        <div class="frosted-card__stat-label">Cost</div>
      </div>

      <div class="frosted-card__stat frosted-card__stat--right">
        <div class="frosted-card__stat-value">{props.power ?? 7}</div>
        <div class="frosted-card__stat-label">Power</div>
      </div>

      <div class="frosted-card__rail frosted-card__rail--left" aria-hidden="true" />
      <div class="frosted-card__rail frosted-card__rail--right" aria-hidden="true" />
      <div class="frosted-card__footer">{props.footer ?? '// S-Class'}</div>
      <div class="frosted-card__grain" aria-hidden="true" />
    </article>
  );
};
