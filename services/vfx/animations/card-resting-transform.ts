const RESTING_ROTATION_SELECTOR = '[data-card-resting-rotation]';

const parseAngleDegrees = (value: string | undefined): number => {
  const match = value?.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(deg|rad|turn)?$/);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;
  if (match[2] === 'rad') return amount * 180 / Math.PI;
  if (match[2] === 'turn') return amount * 360;
  return amount;
};

const rotationOn = (el: Element | null): number => {
  if (!(el instanceof HTMLElement)) return 0;
  return parseAngleDegrees(el.dataset.cardRestingRotation);
};

/**
 * Read the card's visual resting rotation regardless of whether the ref is
 * bound to the rotation owner, a child inside it, or a wrapper around it.
 */
export const cardRestingRotationDegrees = (cardEl: HTMLElement | null): number => {
  if (!cardEl) return 0;
  const owner = cardEl.closest(RESTING_ROTATION_SELECTOR)
    ?? cardEl.querySelector(RESTING_ROTATION_SELECTOR);
  return rotationOn(owner);
};

const formatDegrees = (degrees: number): string => {
  const normalized = Math.abs(degrees) < 0.0001 ? 0 : degrees;
  return Number(normalized.toFixed(4)).toString();
};

/**
 * Compose motion with the desired card rotation. A nested rotation owner is
 * already naturally composited by the browser, so only its delta is applied
 * to the animated wrapper. If the animated node itself owns the rotation,
 * its inline flight transform replaces the CSS transform and the full angle
 * is included here.
 */
export const composeCardFlightTransform = (
  animatedEl: HTMLElement,
  desiredRotationDegrees: number,
  translate: string | null,
  scale: string,
): string => {
  const nestedOwner = animatedEl.querySelector(RESTING_ROTATION_SELECTOR);
  const nestedRotationDegrees = rotationOn(nestedOwner);
  const rotationDelta = desiredRotationDegrees - nestedRotationDegrees;
  return [
    translate ? `translate(${translate})` : '',
    `rotate(${formatDegrees(rotationDelta)}deg)`,
    `scale(${scale})`,
  ].filter(Boolean).join(' ');
};

