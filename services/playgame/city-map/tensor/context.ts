/**
 * Shared container context for the tensor map generator.
 * Replaces window.innerWidth/Height to scope the generator to its container element.
 *
 * When a virtual resolution is set, getContainerWidth/Height return fixed
 * values regardless of actual container pixel size. The canvas CSS stretches
 * the buffer to fill the real container. This makes the world deterministic
 * across all devices.
 */

let _container: HTMLElement | null = null;
let _virtualW: number | null = null;
let _virtualH: number | null = null;
const _resizeListeners: Array<() => void> = [];

export function setTensorContainer(el: HTMLElement): void {
    _container = el;
}

export function clearTensorContainer(): void {
    _container = null;
    _virtualW = null;
    _virtualH = null;
    _resizeListeners.length = 0;
}

/**
 * Lock the coordinate system to a fixed virtual resolution.
 * All generation and rendering uses these dimensions; the canvas is then
 * CSS-scaled to fill the actual container.
 */
export function setVirtualResolution(w: number, h: number): void {
    _virtualW = w;
    _virtualH = h;
}

export function getContainerWidth(): number {
    if (_virtualW !== null) return _virtualW;
    return _container ? _container.clientWidth : window.innerWidth;
}

export function getContainerHeight(): number {
    if (_virtualH !== null) return _virtualH;
    return _container ? _container.clientHeight : window.innerHeight;
}

export function onTensorResize(fn: () => void): void {
    _resizeListeners.push(fn);
}

export function removeTensorResizeListener(fn: () => void): void {
    const i = _resizeListeners.indexOf(fn);
    if (i >= 0) _resizeListeners.splice(i, 1);
}

export function fireTensorResize(): void {
    for (const fn of _resizeListeners) fn();
}
