import type { TensorFieldConfig, TensorGenerationConfig, TensorPreset } from './types';

const PRESETS: Record<TensorPreset, TensorGenerationConfig> = {
  organized_city: {
    preset: 'organized_city',
    roadDensity: { main: 6, major: 16, minor: 60 },
    stepSize: 8,
    collisionRadius: 14,
    simplifyTolerance: 2,
    fields: [
      { id: 'main-grid', kind: 'grid', angle: 0, strength: 1.0 },
      { id: 'cross-grid', kind: 'grid', angle: 90, strength: 0.3 },
      { id: 'center-radial', kind: 'radial', position: { x: 0.5, y: 0.5 }, size: 0.4, strength: 0.2 },
      { id: 'organic-noise', kind: 'noise', strength: 0.08 },
    ],
    clipping: { enabled: true, boundaryMode: 'stop' },
  },

  island_city: {
    preset: 'island_city',
    roadDensity: { main: 8, major: 20, minor: 80 },
    stepSize: 8,
    collisionRadius: 12,
    simplifyTolerance: 2,
    fields: [
      { id: 'coast-parallel', kind: 'coast_following', strength: 0.6 },
      { id: 'downtown-grid', kind: 'grid', angle: 15, position: { x: 0.4, y: 0.5 }, size: 0.3, strength: 0.7 },
      { id: 'port-radial', kind: 'radial', position: { x: 0.25, y: 0.6 }, size: 0.25, strength: 0.4 },
      { id: 'inland-grid', kind: 'grid', angle: -20, position: { x: 0.65, y: 0.45 }, size: 0.3, strength: 0.5 },
      { id: 'organic-noise', kind: 'noise', strength: 0.1 },
    ],
    clipping: { enabled: true, boundaryMode: 'stop' },
  },

  old_downtown: {
    preset: 'old_downtown',
    roadDensity: { main: 4, major: 12, minor: 50 },
    stepSize: 6,
    collisionRadius: 10,
    simplifyTolerance: 1.5,
    fields: [
      { id: 'grid-a', kind: 'grid', angle: 5, strength: 0.6 },
      { id: 'grid-b', kind: 'grid', angle: 35, strength: 0.4 },
      { id: 'grid-c', kind: 'grid', angle: -25, strength: 0.3 },
      { id: 'center-radial', kind: 'radial', position: { x: 0.5, y: 0.5 }, size: 0.3, strength: 0.3 },
      { id: 'organic-noise', kind: 'noise', strength: 0.15 },
    ],
    clipping: { enabled: true, boundaryMode: 'stop' },
  },

  beachfront_resort: {
    preset: 'beachfront_resort',
    roadDensity: { main: 4, major: 10, minor: 30 },
    stepSize: 10,
    collisionRadius: 18,
    simplifyTolerance: 3,
    fields: [
      { id: 'coast-parallel', kind: 'coast_following', strength: 0.8 },
      { id: 'strip-grid', kind: 'grid', angle: 0, strength: 0.5 },
      { id: 'resort-radial', kind: 'radial', position: { x: 0.5, y: 0.5 }, size: 0.5, strength: 0.2 },
      { id: 'organic-noise', kind: 'noise', strength: 0.05 },
    ],
    clipping: { enabled: true, boundaryMode: 'stop' },
  },

  debug_minimal: {
    preset: 'debug_minimal',
    roadDensity: { main: 2, major: 4, minor: 10 },
    stepSize: 12,
    collisionRadius: 20,
    simplifyTolerance: 4,
    fields: [
      { id: 'simple-grid', kind: 'grid', angle: 0, strength: 1.0 },
    ],
    clipping: { enabled: true, boundaryMode: 'stop' },
  },
};

export function resolveTensorConfig(config?: TensorGenerationConfig): TensorGenerationConfig {
  const preset = (config?.preset || 'island_city') as TensorPreset;
  const base = PRESETS[preset] || PRESETS.island_city;
  return {
    ...base,
    ...config,
    roadDensity: { ...base.roadDensity, ...config?.roadDensity },
    clipping: { ...base.clipping, ...config?.clipping },
    fields: config?.fields && config.fields.length > 0 ? config.fields : base.fields,
  };
}
