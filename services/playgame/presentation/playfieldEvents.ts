export type PlayfieldPresentationEvent =
  | { readonly type: 'HIDE_PLAYFIELD' }
  | { readonly type: 'SHOW_PLAYFIELD' };

export type PlayfieldEventPresenter = (
  event: PlayfieldPresentationEvent,
) => Promise<void>;

const PLAYFIELD_TRANSITION_FALLBACK_MS = 2_100;

function waitForOpacityTransition(element: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      element.removeEventListener('transitionend', handleTransitionEnd);
      resolve();
    };
    const handleTransitionEnd = (event: TransitionEvent): void => {
      if (event.target === element && event.propertyName === 'opacity') finish();
    };
    const timeout = setTimeout(finish, PLAYFIELD_TRANSITION_FALLBACK_MS);
    element.addEventListener('transitionend', handleTransitionEnd);
  });
}

/**
 * Owns the DOM/CSS implementation of playfield visibility. Storyboards emit
 * semantic presentation events and never manipulate opacity or class names.
 */
export function createPlayfieldEventPresenter(
  root: HTMLElement,
): PlayfieldEventPresenter {
  return async (event) => {
    if (event.type === 'HIDE_PLAYFIELD') {
      root.classList.add('playfield-hidden');
      return;
    }

    const playfield = root.querySelector<HTMLElement>('.board-game-area');
    root.classList.remove('playfield-hidden');
    if (playfield) await waitForOpacityTransition(playfield);
  };
}
