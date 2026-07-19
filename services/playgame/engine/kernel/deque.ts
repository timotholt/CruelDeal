/** Small deterministic deque specialized for the kernel's bounded work. */
export class KernelWorkDeque<T> {
  readonly #items: T[];

  constructor(initial: readonly T[] = []) {
    this.#items = [...initial];
  }

  get size(): number {
    return this.#items.length;
  }

  get isEmpty(): boolean {
    return this.#items.length === 0;
  }

  popFront(): T | undefined {
    return this.#items.shift();
  }

  /**
   * Places nested work before existing siblings while preserving the
   * expansion's declared left-to-right order.
   */
  prependInOrder(items: readonly T[]): void {
    if (items.length === 0) return;
    this.#items.unshift(...items);
  }
}

