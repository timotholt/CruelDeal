import * as dat from 'dat.gui';

export default class Util {
    /**
     * Used to inflate the draw canvas so there is no gap when panning
     */
    static readonly DRAW_INFLATE_AMOUNT = 1.2;

    /**
     * Element IDs — scoped to tensor component to avoid collision with game UI
     */
    static readonly CANVAS_ID = 'tensor-map-canvas';
    static readonly IMG_CANVAS_ID = 'tensor-img-canvas';
    static readonly SVG_ID = 'tensor-map-svg';

    static randomRange(max: number, min=0): number {
        return (Math.random() * (max - min)) + min;
    }

    static updateGui(gui: dat.GUI): void {
        for (const controller of gui.__controllers) {
            controller.updateDisplay();
        }

        for (const folderName in gui.__folders) {
            Util.updateGui(gui.__folders[folderName]);
        }
    }

    static removeFolder(gui: dat.GUI, name: string): void {
        if (gui.__folders[name] !== undefined) {
            gui.removeFolder(gui.__folders[name]);
        }
    }

    /**
     * CSS Color parser - converts CSS color string to RGB array
     */
    static parseCSSColor(cssColor: string): number[] {
        // Try hex
        const hexMatch = cssColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hexMatch) {
            let hex = hexMatch[1];
            if (hex.length === 3) {
                hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            }
            return [
                parseInt(hex.substring(0, 2), 16),
                parseInt(hex.substring(2, 4), 16),
                parseInt(hex.substring(4, 6), 16),
            ];
        }

        // Try rgb/rgba
        const rgbMatch = cssColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgbMatch) {
            return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
        }

        return [0, 0, 0];
    }
}
