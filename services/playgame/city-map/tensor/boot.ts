import * as dat from 'dat.gui';
import Style, {DefaultStyle, RoughStyle, ColourScheme} from './ui/style';
import {DefaultCanvasWrapper} from './ui/canvas_wrapper';
import DomainController from './ui/domain_controller';
import DragController from './ui/drag_controller';
import TensorFieldGUI from './ui/tensor_field_gui';
import MainGUI from './ui/main_gui';
import {setTensorContainer, clearTensorContainer} from './context';
import colourSchemes from './colour_schemes.json';
import Vector from './vector';
import Util from './util';

export interface TensorBoot {
    cleanup: () => void;
}

/**
 * Initialises the map generator inside the given container + canvas.
 * Must be called after the container is mounted in the DOM.
 */
export function boot(container: HTMLElement, canvas: HTMLCanvasElement): TensorBoot {
    // 1. Context
    setTensorContainer(container);
    DomainController.resetInstance();

    // 2. GUI
    const gui = new dat.GUI({ autoPlace: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemes = colourSchemes as any;

    // 3. Core services
    const domainController = DomainController.getInstance();
    const dragController = new DragController(gui);

    // 4. Initial zoom: don't over-zoom out on large displays
    const STARTING_WIDTH = 1440;
    const screenWidth = domainController.screenDimensions.x;
    if (screenWidth > STARTING_WIDTH) {
        domainController.zoom = screenWidth / STARTING_WIDTH;
    }

    // 5. Root controls: zoom then generate
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

    function changeColourScheme(scheme: string): void {
        const colourScheme: ColourScheme = Object.assign({}, schemes[scheme] as ColourScheme);
        Util.updateGui(styleFolder);
        if (scheme.startsWith('Drawn')) {
            style = new RoughStyle(canvas, dragController, colourScheme);
        } else {
            style = new DefaultStyle(canvas, dragController, colourScheme, scheme.startsWith('Heightmap'));
        }
        style.showFrame = showFrame;
        const scale = highDPI ? 2 : 1;
        style.canvasScale = scale;
        tensorCanvas.canvasScale = scale;
        previousFrameDrawTensor = true;
    }
    changeColourScheme('Default');

    // 9. MainGUI
    const mainGui = new MainGUI(mapFolder, tensorFieldGui, closeTensorFolder);

    // 10. Wire generate — firstGenerate skips tensor field randomisation
    let firstGenerate = true;
    guiActions.generate = () => {
        if (!firstGenerate) tensorFieldGui.setRecommended();
        else firstGenerate = false;
        mainGui.generateEverything().catch((e) => console.error('[TensorMap] generateEverything failed', e));
    };

    // 11. Style folder
    const styleState = {
        colourScheme: 'Default',
        zoomBuildings: false,
        buildingModels: false,
        showFrame: false,
    };
    styleFolder.add(styleState, 'colourScheme', Object.keys(schemes))
        .onChange((val: string) => changeColourScheme(val));
    styleFolder.add(styleState, 'zoomBuildings').onChange((val: boolean) => {
        previousFrameDrawTensor = true;
        style.zoomBuildings = val;
    });
    styleFolder.add(styleState, 'buildingModels').onChange((val: boolean) => {
        previousFrameDrawTensor = true;
        style.showBuildingModels = val;
    });
    styleFolder.add(styleState, 'showFrame').onChange((val: boolean) => {
        showFrame = val;
        previousFrameDrawTensor = true;
        style.showFrame = val;
    });
    styleFolder.add(domainController, 'orthographic');
    const cameraState = { cameraX: 0, cameraY: 0 };
    const updateCamera = () => {
        domainController.cameraDirection = new Vector(cameraState.cameraX / 10, cameraState.cameraY / 10);
    };
    styleFolder.add(cameraState, 'cameraX', -15, 15).step(1).onChange(updateCamera);
    styleFolder.add(cameraState, 'cameraY', -15, 15).step(1).onChange(updateCamera);

    // 12. Options folder
    optionsFolder.add(tensorFieldGui, 'drawCentre');
    const optState = { highDPI: false };
    optionsFolder.add(optState, 'highDPI').onChange((val: boolean) => {
        highDPI = val;
        const scale = val ? 2 : 1;
        style.canvasScale = scale;
        tensorCanvas.canvasScale = scale;
    });

    // 13. Download folder
    const dlState = { imageScale: 3 };
    downloadsFolder.add(dlState, 'imageScale', 1, 5).step(1);
    downloadsFolder.add({ PNG: () => {
        const link = document.createElement('a');
        link.download = 'map.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } }, 'PNG');

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

    // 15. Auto-generate on mount
    mainGui.generateEverything().catch((e) => console.error('[TensorMap] generateEverything failed', e));

    // 16. Cleanup
    return {
        cleanup: () => {
            cancelAnimationFrame(animationId);
            try { gui.destroy(); } catch (_) {}
            DomainController.resetInstance();
            clearTensorContainer();
        },
    };
}
