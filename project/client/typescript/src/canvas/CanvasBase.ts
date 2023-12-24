import { Color, Stroke, Transform } from "../gen/Types.js";

export const SVGNS = "http://www.w3.org/2000/svg";

export class CanvasContext {
	constructor(private svgroot: SVGSVGElement) {}

	public createElement(name: string): SVGElement {
		return document.createElementNS(SVGNS, name);
	}

	public createTransform() {
		return this.svgroot.createSVGTransform();
	}
}

export class TransformHelper {
	private translate: SVGTransform;
	private rotate: SVGTransform;
	private stretch: SVGTransform;
	private _transform: Transform;

	public get value() {
		return this._transform;
	}

	public set value(value) {
		this._transform = value;
		this.update();
	}

	constructor(
		ctx: CanvasContext,
		list: SVGTransformList,
		transform: Transform,
	) {
		this.translate = ctx.createTransform();
		this.rotate = ctx.createTransform();
		this.stretch = ctx.createTransform();

		this._transform = transform;
		list.appendItem(this.translate);
		list.appendItem(this.rotate);
		list.appendItem(this.stretch);
		this.update();
	}

	private update() {
		const {x: tx, y: ty} = this.value.origin;
		this.translate.setTranslate(tx, ty);

		this.rotate.setRotate(this.value.rotation,0,0);

		this.stretch.setScale(
			this.value.stretchX,
			this.value.stretchY,
		);
	}
}

export class StrokeHelper {
	private _stroke: Stroke;

	public get value() {
		return this._stroke;
	}
	public set value(value) {
		this._stroke = value;
		this.update();
	}

	public constructor(
		private style: CSSStyleDeclaration,
		stroke: Stroke,
	) {
		this._stroke = stroke;
		this.update();
	}

	private update() {
		this.style.stroke = this._stroke.color;
		this.style.strokeWidth = this._stroke.width.toString();
	}
}

export class FillHelper {
	private _fill: Color;

	public get value() {
		return this._fill;
	}
	public set value(value) {
		this._fill = value;
		this.update();
	}

	public constructor(
		private style: CSSStyleDeclaration,
		fill: Color,
	) {
		this._fill = fill;
		this.update();
	}

	private update() {
		this.style.fill = this._fill;
	}
}