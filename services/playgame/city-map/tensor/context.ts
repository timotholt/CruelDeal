/**
 * Shared container context for the tensor map generator.
 * Replaces window.innerWidth/Height to scope the generator to its container element.
 */

let _container: HTMLElement | null = null;
const _resizeListeners: Array<() => void> = [];

export function setTensorContainer(el: HTMLElement): void {
    _container = el;
}

export function clearTensorContainer(): void {
    _container = null;
    _resizeListeners.length = 0;
}

export function getContainerWidth(): number {
    return _container ? _container.clientWidth : window.innerWidth;
}

export function getContainerHeight(): number {
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
