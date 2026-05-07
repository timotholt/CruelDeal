import log from 'loglevel';
import Vector from '../vector';
import Util from '../util';
import { getContainerWidth, getContainerHeight, onTensorResize } from '../context';

/**
 * Singleton — controls panning and zooming.
 * Adapted: window.innerWidth/Height replaced with container-aware getters.
 * resetInstance() must be called when the component unmounts.
 */
export default class DomainController {
    private static instance: DomainController;

    private readonly ZOOM_SPEED = 0.96;
    private readonly SCROLL_DELAY = 100;

    // Location of screen origin in world space
    private _origin: Vector = Vector.zeroVector();

    // Screen-space width and height
    private _screenDimensions = Vector.zeroVector();

    // Ratio of screen pixels to world pixels
    private _zoom: number = 1;
    private zoomCallback: () => void = () => {};
    private lastScrolltime = -this.SCROLL_DELAY;

    private _cameraDirection = Vector.zeroVector();
    private _orthographic = false;

    // Set after pan or zoom
    public moved = false;

    private constructor() {
        this.setScreenDimensions();
        onTensorResize(() => this.setScreenDimensions());

        window.addEventListener('wheel', (e: WheelEvent): void => {
            const target = e.target as HTMLElement;
            if (target && target.id === Util.CANVAS_ID) {
                this.lastScrolltime = Date.now();
                const delta: number = e.deltaY;
                if (delta > 0) {
                    this.zoom = this._zoom * this.ZOOM_SPEED;
                } else {
                    this.zoom = this._zoom / this.ZOOM_SPEED;
                }
            }
        });
    }

    get isScrolling(): boolean {
        return Date.now() - this.lastScrolltime < this.SCROLL_DELAY;
    }

    private setScreenDimensions(): void {
        this.moved = true;
        this._screenDimensions.setX(getContainerWidth());
        this._screenDimensions.setY(getContainerHeight());
    }

    public static getInstance(): DomainController {
        if (!DomainController.instance) {
            DomainController.instance = new DomainController();
        }
        return DomainController.instance;
    }

    /** Call on component unmount to allow re-initialization with fresh container dimensions */
    public static resetInstance(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (DomainController as any).instance = undefined;
    }

    pan(delta: Vector) {
        this.moved = true;
        this._origin.sub(delta);
    }

    get origin(): Vector {
        return this._origin.clone();
    }

    get zoom(): number {
        return this._zoom;
    }

    get screenDimensions(): Vector {
        return this._screenDimensions.clone();
    }

    get worldDimensions(): Vector {
        return this.screenDimensions.divideScalar(this._zoom);
    }

    set screenDimensions(v: Vector) {
        this.moved = true;
        this._screenDimensions.copy(v);
    }

    set zoom(z: number) {
        if (z >= 0.3 && z <= 20) {
            this.moved = true;
            const oldWorldSpaceMidpoint = this.origin.add(this.worldDimensions.divideScalar(2));
            this._zoom = z;
            const newWorldSpaceMidpoint = this.origin.add(this.worldDimensions.divideScalar(2));
            this.pan(newWorldSpaceMidpoint.sub(oldWorldSpaceMidpoint));
            this.zoomCallback();
        }
    }

    onScreen(v: Vector): boolean {
        const screenSpace = this.worldToScreen(v.clone());
        return screenSpace.x >= 0 && screenSpace.y >= 0
            && screenSpace.x <= this.screenDimensions.x && screenSpace.y <= this.screenDimensions.y;
    }

    set orthographic(v: boolean) {
        this._orthographic = v;
        this.moved = true;
    }

    get orthographic(): boolean {
        return this._orthographic;
    }

    set cameraDirection(v: Vector) {
        this._cameraDirection = v;
        this.moved = true;
    }

    get cameraDirection(): Vector {
        return this._cameraDirection.clone();
    }

    getCameraPosition(): Vector {
        const centre = new Vector(this._screenDimensions.x / 2, this._screenDimensions.y / 2);
        if (this._orthographic) {
            return centre.add(centre.clone().multiply(this._cameraDirection).multiplyScalar(100));
        }
        return centre.add(centre.clone().multiply(this._cameraDirection));
    }

    setZoomUpdate(callback: () => void): void {
        this.zoomCallback = callback;
    }

    zoomToWorld(v: Vector): Vector {
        return v.divideScalar(this._zoom);
    }

    zoomToScreen(v: Vector): Vector {
        return v.multiplyScalar(this._zoom);
    }

    screenToWorld(v: Vector): Vector {
        return this.zoomToWorld(v).add(this._origin);
    }

    worldToScreen(v: Vector): Vector {
        return this.zoomToScreen(v.sub(this._origin));
    }
}
