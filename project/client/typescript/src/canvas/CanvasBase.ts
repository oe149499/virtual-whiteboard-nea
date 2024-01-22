import { Color, Point, Stroke, Transform } from "../gen/Types.js";
import { State } from "../util/State.js";

export const SVGNS = "http://www.w3.org/2000/svg";

export interface CoordinateMapping {
	screenOrigin: Point,
	stretch: number,
	targetOffset: Point,
}

export class CanvasContext {
	constructor(
		private svgroot: SVGSVGElement,
		public readonly coordMapping: State<CoordinateMapping>,
	) { }

	public createElement<N extends keyof SVGElementTagNameMap>(name: N): SVGElementTagNameMap[N] {
		return document.createElementNS(SVGNS, name);
	}

	public createTransform() {
		return this.svgroot.createSVGTransform();
	}

	public createRootElement<N extends keyof SVGElementTagNameMap>(name: N): SVGElementTagNameMap[N] {
		return this.svgroot.appendChild(this.createElement(name));
	}

	/** @deprecated */
	public translateCoordinate(p: Point): Point;
	public translateCoordinate(x: number, y: number): Point;
	public translateCoordinate(x: number | Point, y?: number): Point {
		const p = (typeof x == "object") ? x : { x, y: y! };
		return this.translate(p);
	}

	public translate(p: Point, m?: CoordinateMapping) {
		const { screenOrigin, stretch, targetOffset } = m ?? this.coordMapping.get();
		return {
			x: ((p.x - screenOrigin.x) / stretch) + targetOffset.x,
			y: ((p.y - screenOrigin.y) / stretch) + targetOffset.y,
		};
	}
}

export class TransformHelper {
	private translate: SVGTransform;
	private rotate: SVGTransform;
	private stretch: SVGTransform;

	constructor(
		private ctx: CanvasContext,
		private list: SVGTransformList,
		transform: Transform | State<Transform>,
	) {
		this.translate = ctx.createTransform();
		this.rotate = ctx.createTransform();
		this.stretch = ctx.createTransform();

		list.appendItem(this.translate);
		list.appendItem(this.rotate);
		list.appendItem(this.stretch);

		if ("get" in transform) {
			transform.watch(this.update.bind(this));
			this.update(transform.get());
		}
		else this.update(transform);
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

	public updateOrigin({ x, y }: Point) {
		this.translate.setTranslate(x, y);
	}

	public createExtra(): SVGTransform {
		const item = this.ctx.createTransform();
		this.list.appendItem(item);
		return item;
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