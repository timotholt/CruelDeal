import log from 'loglevel';
import rough from 'roughjs';
import { SVG } from '@svgdotjs/svg.js';
import Util from '../util';
import Vector from '../vector';
import { getContainerWidth, getContainerHeight, onTensorResize } from '../context';

export default abstract class CanvasWrapper {
    public needsUpdate = true;
    protected _width: number;
    protected _height: number;

    constructor(protected canvas: HTMLCanvasElement,
                protected _scale = 1,
                resizeToWindow = true) {
        if (resizeToWindow) {
            this.setDimensions();
            onTensorResize(() => {
                this.setDimensions();
                this.needsUpdate = true;
            });
        }
    }

    get canvasScale(): number {
        return this._scale;
    }

    set canvasScale(s: number) {
        this._scale = s;
        this.setDimensions();
        this.needsUpdate = true;
    }

    protected setDimensions(): void {
        this._width = getContainerWidth() * this._scale;
        this._height = getContainerHeight() * this._scale;
        this.canvas.width = this._width;
        this.canvas.height = this._height;
        this.canvas.style.width = getContainerWidth() + 'px';
        this.canvas.style.height = getContainerHeight() + 'px';
    }

    abstract clearCanvas(): void;
    abstract drawFrame(left: number, right: number, top: number, bottom: number): void;
    abstract setFillStyle(colour: string): void;
    abstract setStrokeStyle(colour: string): void;
    abstract setLineWidth(width: number): void;
    abstract drawRectangle(x: number, y: number, width: number, height: number): void;
    abstract drawPolygon(polygon: Vector[]): void;
    abstract drawPolyline(polyline: Vector[]): void;
    abstract drawCircle(centre: Vector, radius: number): void;
    abstract drawSquare(centre: Vector, size: number): void;
    abstract getSVGString(colourScheme: object): string;
}

export class DefaultCanvasWrapper extends CanvasWrapper {
    protected ctx: CanvasRenderingContext2D;
    private svgNode: SVGElement | null = null;

    constructor(canvas: HTMLCanvasElement, scale = 1, resizeToWindow = true) {
        super(canvas, scale, resizeToWindow);
        this.ctx = canvas.getContext('2d')!;
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, getContainerWidth(), getContainerHeight());
    }

    clearCanvas(): void {
        const w = getContainerWidth();
        const h = getContainerHeight();
        if (this.svgNode) {
            const startW = w * (Util.DRAW_INFLATE_AMOUNT - 1) / 2;
            const startH = h * (Util.DRAW_INFLATE_AMOUNT - 1) / 2;
            this.drawRectangle(-startW, -startH, w * Util.DRAW_INFLATE_AMOUNT, h * Util.DRAW_INFLATE_AMOUNT);
        } else {
            this.drawRectangle(0, 0, w, h);
        }
    }

    drawFrame(left: number, right: number, top: number, bottom: number): void {
        const w = getContainerWidth();
        const h = getContainerHeight();
        this.drawRectangle(0, 0, left, h);
        this.drawRectangle(w - right, 0, right, h);
        this.drawRectangle(0, 0, w, top);
        this.drawRectangle(0, h - bottom, w, bottom);
    }

    setFillStyle(colour: string): void {
        this.ctx.fillStyle = colour;
    }

    setStrokeStyle(colour: string): void {
        this.ctx.strokeStyle = colour;
    }

    setLineWidth(width: number): void {
        this.ctx.lineWidth = width;
    }

    drawRectangle(x: number, y: number, width: number, height: number): void {
        this.ctx.beginPath();
        this.ctx.rect(x, y, width, height);
        this.ctx.fill();
    }

    drawPolygon(polygon: Vector[]): void {
        if (polygon.length < 2) return;
        this.ctx.beginPath();
        this.ctx.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < polygon.length; i++) {
            this.ctx.lineTo(polygon[i].x, polygon[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawPolyline(polyline: Vector[]): void {
        if (polyline.length < 2) return;
        this.ctx.beginPath();
        this.ctx.moveTo(polyline[0].x, polyline[0].y);
        for (let i = 1; i < polyline.length; i++) {
            this.ctx.lineTo(polyline[i].x, polyline[i].y);
        }
        this.ctx.stroke();
    }

    drawCircle(centre: Vector, radius: number): void {
        this.ctx.beginPath();
        this.ctx.arc(centre.x, centre.y, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawSquare(centre: Vector, size: number): void {
        this.drawRectangle(centre.x - size / 2, centre.y - size / 2, size, size);
    }

    getSVGString(_colourScheme: object): string {
        return '';
    }
}

export class RoughCanvasWrapper extends CanvasWrapper {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private rc: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private options: any = {};

    constructor(canvas: HTMLCanvasElement, scale = 1, resizeToWindow = true) {
        super(canvas, scale, resizeToWindow);
        this.rc = rough.canvas(canvas);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOptions(options: any): void {
        this.options = options;
    }

    clearCanvas(): void {
        const w = getContainerWidth();
        const h = getContainerHeight();
        this.drawRectangle(0, 0, w, h);
    }

    drawFrame(left: number, right: number, top: number, bottom: number): void {
        const w = getContainerWidth();
        const h = getContainerHeight();
        this.drawRectangle(0, 0, left, h);
        this.drawRectangle(w - right, 0, right, h);
        this.drawRectangle(0, 0, w, top);
        this.drawRectangle(0, h - bottom, w, bottom);
    }

    setFillStyle(_colour: string): void {}
    setStrokeStyle(_colour: string): void {}
    setLineWidth(_width: number): void {}

    drawRectangle(x: number, y: number, width: number, height: number): void {
        this.rc.rectangle(x, y, width, height, this.options);
    }

    drawPolygon(polygon: Vector[]): void {
        if (polygon.length < 2) return;
        this.rc.polygon(polygon.map(v => [v.x, v.y]), this.options);
    }

    drawPolyline(polyline: Vector[]): void {
        if (polyline.length < 2) return;
        for (let i = 0; i < polyline.length - 1; i++) {
            this.rc.line(polyline[i].x, polyline[i].y, polyline[i+1].x, polyline[i+1].y, this.options);
        }
    }

    drawCircle(centre: Vector, radius: number): void {
        this.rc.circle(centre.x, centre.y, radius * 2, this.options);
    }

    drawSquare(centre: Vector, size: number): void {
        this.drawRectangle(centre.x - size / 2, centre.y - size / 2, size, size);
    }

    getSVGString(_colourScheme: object): string {
        return '';
    }
}
