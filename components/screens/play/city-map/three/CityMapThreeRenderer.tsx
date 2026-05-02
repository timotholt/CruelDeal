import { createEffect, onCleanup, onMount } from 'solid-js';
import * as THREE from 'three';
import type { CityMapViewport, Size } from '../camera';
import type { CityMapDebugState } from '../CityMapDebugDock';
import type { CityMapRenderModel } from '../render-model';
import { createCityOrthographicCamera, updateCityCamera } from './cityCamera';
import { createCityScene } from './createCityScene';
import { disposeThreeObject } from './disposeThree';

export interface CityMapThreeRendererProps {
  model: CityMapRenderModel;
  viewport: CityMapViewport;
  surfaceSize: Size;
  debugState: CityMapDebugState;
}

export const CityMapThreeRenderer = (props: CityMapThreeRendererProps) => {
  let hostEl: HTMLDivElement | undefined;
  let renderer: THREE.WebGLRenderer | undefined;
  let scene: THREE.Scene | undefined;
  let camera: THREE.OrthographicCamera | undefined;
  let sceneKey = '';

  const renderFrame = () => {
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
  };

  onMount(() => {
    if (!hostEl) return;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'city-map-three-renderer__canvas';
    hostEl.append(renderer.domElement);

    scene = createCityScene(props.model, props.debugState).scene;
    sceneKey = `${props.model.city.seed}:${props.debugState.showRoads}:${props.debugState.showBuildings}:${props.debugState.showTerrainDebug}`;
    camera = createCityOrthographicCamera();
    updateCityCamera(camera, props.viewport, props.surfaceSize);
    renderFrame();
  });

  createEffect(() => {
    const model = props.model;
    const debugState = props.debugState;
    const nextSceneKey = `${model.city.seed}:${debugState.showRoads}:${debugState.showBuildings}:${debugState.showTerrainDebug}`;
    if (!renderer || !camera) return;
    if (nextSceneKey !== sceneKey) {
      if (scene) disposeThreeObject(scene);
      scene = createCityScene(model, debugState).scene;
      sceneKey = nextSceneKey;
    }
    const { width, height } = props.surfaceSize;
    renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    updateCityCamera(camera, props.viewport, props.surfaceSize);
    renderFrame();
  });

  onCleanup(() => {
    if (scene) disposeThreeObject(scene);
    renderer?.dispose();
    renderer?.domElement.remove();
    renderer = undefined;
    scene = undefined;
    camera = undefined;
  });

  return (
    <div
      ref={(el) => {
        hostEl = el;
      }}
      class="city-map-three-renderer"
      aria-hidden="true"
    />
  );
};
