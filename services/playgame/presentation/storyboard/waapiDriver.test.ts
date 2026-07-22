import { describe, expect, it } from 'vitest';

import { NativeWaapiDriver } from './waapiDriver';

describe('NativeWaapiDriver browser boundary', () => {
  it('rejects a detached document instead of waiting forever on its inert timeline', () => {
    const detachedDocument = document.implementation.createHTMLDocument('detached');

    expect(() => new NativeWaapiDriver(
      detachedDocument,
      () => document.body,
      window,
    )).toThrow('Native WAAPI driver requires a live document/window pair');
  });
});
