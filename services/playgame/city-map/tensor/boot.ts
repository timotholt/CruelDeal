import * as dat from 'dat.gui';
import Style, {DefaultStyle, RoughStyle, ColourScheme} from './ui/style';
import {DefaultCanvasWrapper} from './ui/canvas_wrapper';
import DomainController from './ui/domain_controller';
import DragController from './ui/drag_controller';
import TensorFieldGUI from './ui/tensor_field_gui';
import MainGUI from './ui/main_gui';
import {setTensorContainer, clearTensorContainer, setVirtualResolution} from './context';
import { setTensorSeed } from './rng';
import colourSchemes from './colour_schemes.json';
import Vector from './vector';
import Util from './util';
import { MAP_SHAPES, type MapShape } from './types';
import {
    MAP_SIZES,
    setWorldDimensions,
    VIEWPORT_DIMENSIONS,
    WORLD_ORIGIN,
    WORLD_DIMENSIONS,
    type TensorMapSize,
} from './world';

export interface TensorBootOptions {
    seed?: string;
    mapShape?: MapShape;
    mapSize?: TensorMapSize;
}

export interface TensorBoot {
    cleanup: () => void;
    generate: () => void;
    setZoom: (z: number) => number;
    getZoom: () => number;
    getMinZoom: () => number;
    setColourScheme: (scheme: string) => void;
    getColourSchemes: () => string[];
    setZoomBuildings: (enabled: boolean) => void;
    setBuildingModels: (enabled: boolean) => void;
    setShowFrame: (enabled: boolean) => void;
    setOrthographic: (enabled: boolean) => void;
    setCamera: (x: number, y: number) => void;
    setDrawCentre: (enabled: boolean) => void;
    setHighDPI: (enabled: boolean) => void;
    downloadPng: () => void;
    setMapShape: (shape: MapShape) => void;
    getMapShape: () => MapShape;
    getMapShapes: () => MapShape[];
    setMapSize: (size: TensorMapSize) => void;
    getMapSize: () => TensorMapSize;
    getMapSizes: () => TensorMapSize[];
}

/**
 * Initialises the map generator inside the given container + canvas.
 * Must be called after the container is mounted in the DOM.
 */
export function boot(container: HTMLElement, canvas: HTMLCanvasElement, options: TensorBootOptions = {}): TensorBoot {
    // 0. Seed RNG for deterministic generation
    setTensorSeed(options.seed ?? 'tensor-default');
    setWorldDimensions(options.mapSize ?? 'large');

    // 1. Context — lock to fixed virtual resolution (device-independent)
    setTensorContainer(container);
    setVirtualResolution(VIEWPORT_DIMENSIONS.x, VIEWPORT_DIMENSIONS.y);
    DomainController.resetInstance();

    // 2. GUI — scoped inside the container, not document.body
    const gui = new dat.GUI({ autoPlace: false });
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '0';
    gui.domElement.style.right = '0';
    gui.domElement.style.zIndex = '100';
    gui.domElement.style.display = 'none';
    container.appendChild(gui.domElement);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemes = colourSchemes as any;

    // 3. Core services
    const domainController = DomainController.getInstance();
    domainController.frameBounds(WORLD_ORIGIN, WORLD_DIMENSIONS);
    const dragController = new DragController(gui);

    // 4. Root controls: zoom then generate
    const zoomController = gui.add(domainController, 'zoom', 0.2, 5).step(0.1);
    domainController.setZoomUpdate(() => zoomController.updateDisplay());

    const guiActions = { generate: () => {} };
    gui.add(guiActions, 'generate');

    // 6. Folders (order matches original)
    const tensorFolder = gui.addFolder('Tensor Field');
    const mapFolder    = gui.addFolder('Map');
    const styleFolder  = gui.addFolder('Style');
    const optionsFolder   = gui.addFolder('Options');
    const downloadsFolder = gui.addFolder('Download');

    // 7. TensorField
    const tensorFieldGui = new TensorFieldGUI(tensorFolder, dragController, true, {
        globalNoise: false,
        noiseSizePark: 20,
        noiseAnglePark: 90,
        noiseSizeGlobal: 30,
        noiseAngleGlobal: 20,
    });
    tensorFieldGui.setRecommended();

    // 8. Style state + helpers
    const closeTensorFolder = () => tensorFolder.close();
    const tensorCanvas = new DefaultCanvasWrapper(canvas, 1, true);
    let previousFrameDrawTensor = true;
    let style: Style;
    let showFrame = false;
    let highDPI = false;
    const styleState = {
        colourScheme: 'Default',
        zoomBuildings: false,
        buildingModels: false,
        showFrame: false,
    };

    function changeColourScheme(scheme: string): void {
        if (!schemes[scheme]) return;
        styleState.colourScheme = scheme;
        const colourScheme: ColourScheme = Object.assign({}, schemes[scheme] as ColourScheme);
        Util.updateGui(styleFolder);
        if (scheme.startsWith('Drawn')) {
            style = new RoughStyle(canvas, dragController, colourScheme);
        } else {
            style = new DefaultStyle(canvas, dragController, colourScheme, scheme.startsWith('Heightmap'));
        }
        style.showFrame = showFrame;
        style.zoomBuildings = styleState.zoomBuildings;
        style.showBuildingModels = styleState.buildingModels;
        const scale = highDPI ? 2 : 1;
        style.canvasScale = scale;
        tensorCanvas.canvasScale = scale;
        previousFrameDrawTensor = true;
    }
    changeColourScheme('Default');

    // 9. MainGUI
    const mainGui = new MainGUI(mapFolder, tensorFieldGui, closeTensorFolder);
    const shapeState = { mapShape: (options.mapShape ?? 'peninsula') as MapShape };
    const sizeState = { mapSize: (options.mapSize ?? 'large') as TensorMapSize };
    mainGui.setMapShape(shapeState.mapShape);

    // 10. Wire generate
    let generateCount = 0;
    const mapShapeController = mapFolder.add(shapeState, 'mapShape', MAP_SHAPES)
        .onChange((val: MapShape) => mainGui.setMapShape(val));
    const mapSizeController = mapFolder.add(sizeState, 'mapSize', MAP_SIZES)
        .onChange((val: TensorMapSize) => {
            setWorldDimensions(val);
            mainGui.refreshWorldDimensions();
            resetViewToWorld();
        });

    // 11. Style folder
    const colourSchemeController = styleFolder.add(styleState, 'colourScheme', Object.keys(schemes))
        .onChange((val: string) => changeColourScheme(val));
    const zoomBuildingsController = styleFolder.add(styleState, 'zoomBuildings').onChange((val: boolean) => {
        previousFrameDrawTensor = true;
        style.zoomBuildings = val;
    });
    const buildingModelsController = styleFolder.add(styleState, 'buildingModels').onChange((val: boolean) => {
        previousFrameDrawTensor = true;
        style.showBuildingModels = val;
    });
    const showFrameController = styleFolder.add(styleState, 'showFrame').onChange((val: boolean) => {
        showFrame = val;
        previousFrameDrawTensor = true;
        style.showFrame = val;
    });
    const orthographicController = styleFolder.add(domainController, 'orthographic');
    const cameraState = { cameraX: 0, cameraY: 0 };
    const updateCamera = () => {
        domainController.cameraDirection = new Vector(cameraState.cameraX / 10, cameraState.cameraY / 10);
    };
    const cameraXController = styleFolder.add(cameraState, 'cameraX', -15, 15).step(1).onChange(updateCamera);
    const cameraYController = styleFolder.add(cameraState, 'cameraY', -15, 15).step(1).onChange(updateCamera);

    // 12. Options folder
    const drawCentreController = optionsFolder.add(tensorFieldGui, 'drawCentre');
    const optState = { highDPI: false };
    const highDPIController = optionsFolder.add(optState, 'highDPI').onChange((val: boolean) => {
        highDPI = val;
        const scale = val ? 2 : 1;
        style.canvasScale = scale;
        tensorCanvas.canvasScale = scale;
        previousFrameDrawTensor = true;
    });

    // 13. Download folder
    const dlState = { imageScale: 3 };
    downloadsFolder.add(dlState, 'imageScale', 1, 5).step(1);
    const downloadPng = () => {
        const link = document.createElement('a');
        link.download = 'map.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
    downloadsFolder.add({ PNG: downloadPng }, 'PNG');

    const resetViewToWorld = () => {
        cameraState.cameraX = 0;
        cameraState.cameraY = 0;
        updateCamera();
        domainController.frameBounds(WORLD_ORIGIN, WORLD_DIMENSIONS);
        zoomController.updateDisplay();
        cameraXController.updateDisplay();
        cameraYController.updateDisplay();
    };

    guiActions.generate = () => {
        resetViewToWorld();
        setTensorSeed(`${options.seed ?? 'tensor-default'}::gen${generateCount++}`);
        tensorFieldGui.setRecommended();
        mainGui.generateEverything().catch((e) => console.error('[TensorMap] generateEverything failed', e));
    };

    const showTensorField = () => !tensorFolder.closed || mainGui.roadsEmpty();

    // 14. Render loop
    let animationId = 0;
    const loop = () => {
        mainGui.update();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (style as any).update === 'function') (style as any).update();
        if (showTensorField()) {
            previousFrameDrawTensor = true;
            dragController.setDragDisabled(false);
            tensorFieldGui.draw(tensorCanvas);
        } else {
            dragController.setDragDisabled(true);
            if (previousFrameDrawTensor) {
                previousFrameDrawTensor = false;
                mainGui.draw(style, true);
            } else {
                mainGui.draw(style);
            }
        }
        animationId = requestAnimationFrame(loop);
    };
    loop();

    // 15. Auto-generate on mount (animate=false for instant results)
    mainGui.generateEverything(false).catch((e) => console.error('[TensorMap] generateEverything failed', e));

    // 16. Cleanup
    return {
        generate: () => guiActions.generate(),
        setZoom: (z: number) => {
            domainController.setZoomAroundBoundsCenter(z);
            zoomController.updateDisplay();
            return domainController.zoom;
        },
        getZoom: () => domainController.zoom,
        getMinZoom: () => domainController.minZoom,
        setColourScheme: (scheme: string) => {
            changeColourScheme(scheme);
            colourSchemeController.updateDisplay();
        },
        getColourSchemes: () => Object.keys(schemes),
        setZoomBuildings: (enabled: boolean) => {
            styleState.zoomBuildings = enabled;
            previousFrameDrawTensor = true;
            style.zoomBuildings = enabled;
            zoomBuildingsController.updateDisplay();
        },
        setBuildingModels: (enabled: boolean) => {
            styleState.buildingModels = enabled;
            previousFrameDrawTensor = true;
            style.showBuildingModels = enabled;
            buildingModelsController.updateDisplay();
        },
        setShowFrame: (enabled: boolean) => {
            styleState.showFrame = enabled;
            showFrame = enabled;
            previousFrameDrawTensor = true;
            style.showFrame = enabled;
            showFrameController.updateDisplay();
        },
        setOrthographic: (enabled: boolean) => {
            domainController.orthographic = enabled;
            orthographicController.updateDisplay();
        },
        setCamera: (x: number, y: number) => {
            cameraState.cameraX = x;
            cameraState.cameraY = y;
            updateCamera();
            domainController.setViewPanFractions(x / 15, y / 15);
            cameraXController.updateDisplay();
            cameraYController.updateDisplay();
        },
        setDrawCentre: (enabled: boolean) => {
            tensorFieldGui.drawCentre = enabled;
            previousFrameDrawTensor = true;
            drawCentreController.updateDisplay();
        },
        setHighDPI: (enabled: boolean) => {
            optState.highDPI = enabled;
            highDPI = enabled;
            const scale = enabled ? 2 : 1;
            style.canvasScale = scale;
            tensorCanvas.canvasScale = scale;
            previousFrameDrawTensor = true;
            highDPIController.updateDisplay();
        },
        downloadPng,
        setMapShape: (shape: MapShape) => {
            shapeState.mapShape = shape;
            mainGui.setMapShape(shape);
            mapShapeController.updateDisplay();
        },
        getMapShape: () => shapeState.mapShape,
        getMapShapes: () => MAP_SHAPES.slice(),
        setMapSize: (size: TensorMapSize) => {
            sizeState.mapSize = size;
            setWorldDimensions(size);
            mainGui.refreshWorldDimensions();
            resetViewToWorld();
            mapSizeController.updateDisplay();
        },
        getMapSize: () => sizeState.mapSize,
        getMapSizes: () => MAP_SIZES.slice(),
        cleanup: () => {
            cancelAnimationFrame(animationId);
            try { gui.domElement.remove(); } catch (_) {}
            try { gui.destroy(); } catch (_) {}
            DomainController.resetInstance();
            clearTensorContainer();
        },
    };
}
