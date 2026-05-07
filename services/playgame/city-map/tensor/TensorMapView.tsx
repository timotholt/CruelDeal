import { onMount, onCleanup, createSignal } from 'solid-js';
import { boot } from './boot';
import Util from './util';
import './TensorMapView.css';

/**
 * SolidJS wrapper for the MapGenerator-master tensor city map generator.
 * Mounts the canvas + dat.gui, then initialises the generator on mount.
 */
export default function TensorMapView() {
    let containerRef: HTMLDivElement | undefined;
    let canvasRef: HTMLCanvasElement | undefined;

    onMount(() => {
        if (!containerRef || !canvasRef) return;

        const { cleanup } = boot(containerRef, canvasRef);
        onCleanup(cleanup);
    });

    return (
        <div
            ref={containerRef!}
            class="tensor-map-container"
        >
            <canvas
                id={Util.CANVAS_ID}
                ref={canvasRef!}
                class="tensor-map-canvas"
            />
        </div>
    );
}
