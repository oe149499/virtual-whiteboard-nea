import { Color, Stroke, Transform } from "../gen/Types.js";

export const SVGNS = "http://www.w3.org/2000/svg";

export class CanvasContext {
	constructor(private svgroot: SVGSVGElement) { }

	public createElement<N extends keyof SVGElementTagNameMap>(name: N): SVGElementTagNameMap[N] {
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

	constructor(
		ctx: CanvasContext,
		list: SVGTransformList,
		transform: Transform,
	) {
		this.translate = ctx.createTransform();
		this.rotate = ctx.createTransform();
		this.stretch = ctx.createTransform();

		list.appendItem(this.translate);
		list.appendItem(this.rotate);
		list.appendItem(this.stretch);
		this.update(transform);
	}

	public update(value: Transform) {
		const { x: tx, y: ty } = value.origin;
		this.translate.setTranslate(tx, ty);

		this.rotate.setRotate(value.rotation, 0, 0);

		this.stretch.setScale(
			value.stretchX,
			value.stretchY,
		);
	}
}

export class StrokeHelper {
	public constructor(
		private style: CSSStyleDeclaration,
		stroke: Stroke,
	) {
		this.update(stroke);
	}

	public update(stroke: Stroke) {
		this.style.stroke = stroke.color;
		this.style.strokeWidth = stroke.width.toString();
	}
}

export class FillHelper {
	public constructor(
		private style: CSSStyleDeclaration,
		fill: Color,
	) {
		this.update(fill);
	}

	public update(value: Color) {
		this.style.fill = value;
	}
}