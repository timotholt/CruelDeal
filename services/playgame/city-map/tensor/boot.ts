import * as dat from 'dat.gui';
import {DefaultStyle} from './ui/style';
import {DefaultCanvasWrapper} from './ui/canvas_wrapper';
import DomainController from './ui/domain_controller';
import DragController from './ui/drag_controller';
import TensorFieldGUI from './ui/tensor_field_gui';
import MainGUI from './ui/main_gui';
import {setTensorContainer, clearTensorContainer} from './context';
import colourSchemes from './colour_schemes.json';

export interface TensorBoot {
    cleanup: () => void;
}

/**
 * Initialises the map generator inside the given container + canvas.
 * Must be called after the container is mounted in the DOM.
 */
export function boot(container: HTMLElement, canvas: HTMLCanvasElement): TensorBoot {
    // 1. Bind context so DomainController uses the container size
    setTensorContainer(container);
    DomainController.resetInstance();

    // 2. dat.GUI + colour scheme
    const gui = new dat.GUI({ autoPlace: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemes = colourSchemes as any;
    let schemeKey: string = Object.keys(schemes)[0];
    let colourScheme = schemes[schemeKey];

    // 3. Core services
    const domainController = DomainController.getInstance();
    const dragController = new DragController(gui);

    // 4. Root-level: zoom then generate (matches original main.ts order)
    const zoomController = gui.add(domainController, 'zoom', 0.2, 5).step(0.1);
    domainController.setZoomUpdate(() => zoomController.updateDisplay());

    // generate uses a mutable ref so mainGui can be assigned after folder setup
    const guiActions = { generate: () => {} };
    gui.add(guiActions, 'generate');

    // 5. Folders
    const tensorFolder = gui.addFolder('Tensor Field');
    const mapFolder = gui.addFolder('Map');
    const styleFolder = gui.addFolder('Style');

    // 6. TensorField
    const tensorFieldGui = new TensorFieldGUI(
        tensorFolder,
        dragController,
        true,
        {
            globalNoise: false,
            noiseSizePark: 20,
            noiseAnglePark: 90,
            noiseSizeGlobal: 30,
            noiseAngleGlobal: 20,
        }
    );
    tensorFieldGui.setRecommended();

    // 7. Style + MainGUI
    const closeTensorFolder = () => tensorFolder.close();
    const style = new DefaultStyle(canvas, dragController, colourScheme);
    const tensorCanvas = new DefaultCanvasWrapper(canvas, 1, true);
    const mainGui = new MainGUI(mapFolder, tensorFieldGui, closeTensorFolder);

    // Wire up generate now that mainGui exists
    guiActions.generate = () => {
        tensorFieldGui.setRecommended();
        mainGui.generateEverything().catch((e) => console.error('[TensorMap] generateEverything failed', e));
    };

    // 8. Style folder
    const styleObj = { colourScheme: schemeKey };
    styleFolder.add(styleObj, 'colourScheme', Object.keys(schemes)).onChange((val: string) => {
        schemeKey = val;
        colourScheme = schemes[val];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (style as any).colourScheme = colourScheme;
    });
    styleFolder.add(tensorFieldGui, 'drawCentre');

    const showTensorField = () => !tensorFolder.closed || mainGui.roadsEmpty();

    // 9. Render loop (mirrors original main.ts draw logic)
    let previousFrameDrawTensor = true;
    let animationId = 0;
    const loop = () => {
        mainGui.update();
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

    // 10. Auto-generate on mount
    mainGui.generateEverything().catch((e) => console.error('[TensorMap] generateEverything failed', e));

    // 11. Cleanup
    return {
        cleanup: () => {
            cancelAnimationFrame(animationId);
            try { gui.destroy(); } catch (_) {}
            DomainController.resetInstance();
            clearTensorContainer();
        },
    };
}
