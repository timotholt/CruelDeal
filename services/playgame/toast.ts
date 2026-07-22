/**
 * Toast/banner — ported from ccg/vfx-engine/project/ui/messages.js.
 *
 * Imperatively appends a `.toast` div into a `.toast-area` element, auto-
 * removing after `duration` ms. Solid doesn't track these DOM nodes;
 * they're pure presentational chrome owned by the script engine.
 */

export interface ShowToastOpts {
  duration?: number;
  autoDismiss?: boolean;
}

export interface ToastHandle {
  readonly element: HTMLElement;
  dismiss(): void;
}

/** Show a toast inside the given toast-area element. */
export function showToast(
  area: HTMLElement,
  message: string,
  opts: ShowToastOpts = {},
): ToastHandle {
  const t = document.createElement('div');
  t.className = 'toast';
  if (message.startsWith('TURN')) t.classList.add('turn-msg');
  t.textContent = message;
  const duration = opts.duration ?? 1100;
  t.style.setProperty('--toast-duration', `${duration}ms`);
  area.classList.add('has-message');
  area.appendChild(t);
  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    if (timeout !== null) clearTimeout(timeout);
    t.remove();
    if (!area.querySelector('.toast')) area.classList.remove('has-message');
  };
  const timeout = opts.autoDismiss === false
    ? null
    : setTimeout(dismiss, duration + 100);
  return { element: t, dismiss };
}

/**
 * Recompute the vertical anchor for center-anchored toasts. Matches the
 * demo's messages.updateCenter(): positions the toast area's CSS
 * `--message-center-y` so toasts sit vertically centered on the
 * locations row (the board's visual center).
 */
export function updateToastCenter(board: HTMLElement, anchor: HTMLElement): void {
  const boardRect = board.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const y = anchorRect.top - boardRect.top + anchorRect.height / 2;
  board.style.setProperty('--message-center-y', `${y}px`);
}
