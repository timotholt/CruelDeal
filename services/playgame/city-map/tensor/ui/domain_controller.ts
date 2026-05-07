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
    private boundsOrigin: Vector | null = null;
    private boundsDimensions: Vector | null = null;

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
        this.clampOriginToBounds();
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
        const minZoom = this.getMinZoomForBounds();
        const nextZoom = Math.max(minZoom, Math.min(20, z));
        if (nextZoom >= 0.3 && nextZoom <= 20) {
            this.moved = true;
            const oldWorldSpaceMidpoint = this.origin.add(this.worldDimensions.divideScalar(2));
            this._zoom = nextZoom;
            const newWorldSpaceMidpoint = this.origin.add(this.worldDimensions.divideScalar(2));
            this.pan(newWorldSpaceMidpoint.sub(oldWorldSpaceMidpoint));
            this.clampOriginToBounds();
            this.zoomCallback();
        }
    }

    frameBounds(origin: Vector, dimensions: Vector, padding = 1): void {
        this.boundsOrigin = origin.clone();
        this.boundsDimensions = dimensions.clone();
        const fitZoom = Math.min(
            this._screenDimensions.x / dimensions.x,
            this._screenDimensions.y / dimensions.y
        ) * padding;
        this._zoom = Math.max(0.3, Math.min(20, fitZoom));
        const viewportWorldDimensions = this.worldDimensions;
        this._origin = origin.clone()
            .add(dimensions.clone().divideScalar(2))
            .sub(viewportWorldDimensions.divideScalar(2));
        this.clampOriginToBounds();
        this.moved = true;
        this.zoomCallback();
    }

    private getMinZoomForBounds(): number {
        if (!this.boundsDimensions) return 0.3;
        return Math.max(
            0.3,
            this._screenDimensions.x / this.boundsDimensions.x,
            this._screenDimensions.y / this.boundsDimensions.y
        );
    }

    private clampOriginToBounds(): void {
        if (!this.boundsOrigin || !this.boundsDimensions) return;

        const view = this.worldDimensions;
        const minX = this.boundsOrigin.x;
        const minY = this.boundsOrigin.y;
        const maxX = this.boundsOrigin.x + this.boundsDimensions.x - view.x;
        const maxY = this.boundsOrigin.y + this.boundsDimensions.y - view.y;

        if (maxX < minX) {
            this._origin.x = this.boundsOrigin.x + (this.boundsDimensions.x - view.x) / 2;
        } else {
            this._origin.x = Math.max(minX, Math.min(maxX, this._origin.x));
        }

        if (maxY < minY) {
            this._origin.y = this.boundsOrigin.y + (this.boundsDimensions.y - view.y) / 2;
        } else {
            this._origin.y = Math.max(minY, Math.min(maxY, this._origin.y));
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
