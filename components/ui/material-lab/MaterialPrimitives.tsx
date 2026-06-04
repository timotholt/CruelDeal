// Barrel for the surface system. The implementation is split for separation of
// concerns; this file preserves the original public import path.
//
//   surfaceSchema   — type vocabulary + option/prop interfaces (pure types)
//   surfaceTokens   — color/tone tables + hex utils (internal)
//   surfaceFeatures — flags -> classes/vars pipeline + emission plan
//   Surface         — the leaf Solid components (MaterialButton/MaterialPanel)
//   widgets         — unrelated presentational widgets
export * from './surfaceSchema';
export * from './surfaceFeatures';
export * from './Surface';
export * from './widgets';
