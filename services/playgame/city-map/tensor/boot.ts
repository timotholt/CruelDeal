import * as dat from 'dat.gui';
import {DefaultStyle} from './ui/style';
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

    // 2. dat.GUI
    const gui = new dat.GUI({ autoPlace: true });

    // 3. Folders
    const tensorFolder = gui.addFolder('Tensor Field');
    const mapFolder = gui.addFolder('Map');

    // 4. Colour scheme (first entry in JSON)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemes = colourSchemes as any;
    const schemeKey = Object.keys(schemes)[0];
    const colourScheme = schemes[schemeKey];

    // 5. Core services
    const dragController = new DragController(gui);

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

    // Pre-populate with a recommended field layout
    tensorFieldGui.setRecommended();

    // 6. Style + MainGUI
    const closeTensorFolder = () => tensorFolder.close();
    const style = new DefaultStyle(canvas, dragController, colourScheme);
    const mainGui = new MainGUI(mapFolder, tensorFieldGui, closeTensorFolder);

    // 7. Render loop
    let animationId = 0;
    const loop = () => {
        mainGui.update();
        mainGui.draw(style);
        animationId = requestAnimationFrame(loop);
    };
    loop();

    // 8. Cleanup
    return {
        cleanup: () => {
            cancelAnimationFrame(animationId);
            try { gui.destroy(); } catch (_) {}
            DomainController.resetInstance();
            clearTensorContainer();
        },
    };
}
