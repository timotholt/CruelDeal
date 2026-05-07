import * as dat from 'dat.gui';
import interact from 'interactjs';
import Vector from '../vector';
import DomainController from './domain_controller';
import Util from '../util';

interface Draggable {
    getCentre: () => Vector;
    startListener: () => void;
    moveListener: (v: Vector) => void;
}

/**
 * Register multiple centre points.
 * Closest one to mouse click will be selected to drag.
 * Up to caller to actually move their centre point via callback.
 */
export default class DragController {
    private readonly MIN_DRAG_DISTANCE = 50;

    private draggables: Draggable[] = [];
    private currentlyDragging: Draggable | null = null;
    private _isDragging = false;
    private disabled = false;
    private domainController = DomainController.getInstance();

    constructor(private gui: dat.GUI) {
        interact(`#${Util.CANVAS_ID}`).draggable({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onstart: (e: any) => this.dragStart(e),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onmove: (e: any) => this.dragMove(e),
            onend: () => this.dragEnd(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cursorChecker: (_a: any, _b: any, _c: any, interacting: boolean) =>
                interacting ? 'grabbing' : 'grab',
        });
    }

    setDragDisabled(disable: boolean): void {
        this.disabled = disable;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dragStart(event: any): void {
        this._isDragging = true;
        const origin = this.domainController.screenToWorld(new Vector(event.x0, event.y0));

        let closestDistance = Infinity;
        this.draggables.forEach(draggable => {
            const d = draggable.getCentre().distanceTo(origin);
            if (d < closestDistance) {
                closestDistance = d;
                this.currentlyDragging = draggable;
            }
        });

        const scaledDragDistance = this.MIN_DRAG_DISTANCE / this.domainController.zoom;
        if (closestDistance > scaledDragDistance) {
            this.currentlyDragging = null;
        } else {
            this.currentlyDragging!.startListener();
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dragMove(event: any): void {
        const delta = new Vector(event.delta.x, event.delta.y);
        this.domainController.zoomToWorld(delta);  // Mutates delta to world space

        if (!this.disabled && this.currentlyDragging !== null) {
            this.currentlyDragging.moveListener(delta);
        } else {
            this.domainController.pan(delta);
        }
    }

    dragEnd(): void {
        this._isDragging = false;
        this.domainController.pan(Vector.zeroVector());
        this.currentlyDragging = null;
        Util.updateGui(this.gui);
    }

    get isDragging(): boolean {
        return this._isDragging;
    }

    /**
     * @param getCentre - returns the centre point
     * @param onMove - called on move with delta vector (world-space)
     * @param onStart - called on drag start
     * @returns deregister function
     */
    register(getCentre: () => Vector,
             onMove: (v: Vector) => void,
             onStart: () => void): () => void {
        const draggable: Draggable = {
            getCentre,
            moveListener: onMove,
            startListener: onStart,
        };
        this.draggables.push(draggable);
        return () => {
            const index = this.draggables.indexOf(draggable);
            if (index >= 0) this.draggables.splice(index, 1);
        };
    }
}
