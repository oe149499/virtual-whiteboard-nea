import { Color, Point, Stroke, Transform } from "../gen/Types.js";
import { State } from "../util/State.js";
import { FilterHandle, GestureHandler, GestureLayer } from "./Gesture.js";
import { ItemTable } from "./ItemTable.js";

export const SVGNS = "http://www.w3.org/2000/svg";

export interface CoordinateMapping {
	screenOrigin: Point;
	stretch: number;
	targetOffset: Point;
}

export type CanvasContextExecutor = (_: {
	gestures: GestureHandler,
}) => void;

export class CanvasContext {
	constructor(
		private svgroot: SVGSVGElement,
		public readonly coordMapping: State<CoordinateMapping>,
		public readonly items: ItemTable,
		exec?: CanvasContextExecutor,
	) {
		exec?.({
			gestures: this.gestures,
		});
	}

	private gestures = new GestureHandler(this);

	public createGestureFilter(layer: GestureLayer): FilterHandle {
		return this.gestures.makeFilter(layer);
	}

	public createElement<N extends keyof SVGElementTagNameMap>(name: N): SVGElementTagNameMap[N] {
		return document.createElementNS(SVGNS, name);
	}

	public createTransform(matrix?: DOMMatrixReadOnly) {
		const transform = this.svgroot.createSVGTransform();
		if (matrix) transform.setMatrix(matrix);
		return transform;
	}

	public createPoint(p?: Point): SVGPoint {
		const point = this.svgroot.createSVGPoint();
		if (p) {
			point.x = p.x;
			point.y = p.y;
		}
		return point;
	}

	public createPointBy = (s: State<Point>) => {
		const point = this.createPoint();
		return s.derived(({ x, y }) => {
			point.x = x;
			point.y = y;
			return point;
		});
	};

	public createRect(pos: Point, size: Point) {
		const rect = this.svgroot.createSVGRect();
		rect.x = pos.x;
		rect.y = pos.y;
		rect.width = size.x;
		rect.height = size.y;
		return rect;
	}

	public createRootElement<N extends keyof SVGElementTagNameMap>(name: N): SVGElementTagNameMap[N] {
		return this.svgroot.appendChild(this.createElement(name));
	}

	public translate(p: Point, m?: CoordinateMapping) {
		const { screenOrigin, stretch, targetOffset } = m ?? this.coordMapping.get();
		return {
			x: ((p.x - screenOrigin.x) / stretch) + targetOffset.x,
			y: ((p.y - screenOrigin.y) / stretch) + targetOffset.y,
		};
	}
}

export class MatrixHelper {
	private svgTransform: SVGTransform;

	constructor(
		list: SVGTransformList,
		private matrix: State<DOMMatrix>,
	) {
		this.svgTransform = list.createSVGTransformFromMatrix(matrix.get());
		list.appendItem(this.svgTransform);
		matrix.watch(m => this.svgTransform.setMatrix(m));
	}
}

export class TranslateHelper {
	private svgTransform: SVGTransform;
	constructor(
		list: SVGTransformList,
		private position: State<Point>,
	) {
		this.svgTransform = list.createSVGTransformFromMatrix();
		list.appendItem(this.svgTransform);
		const matrix = this.svgTransform.matrix;
		position.watch(({ x, y }) => {
			matrix.e = x;
			matrix.f = y;
		});
	}
}

export class TransformHelper {
	private svgTransform: SVGTransform;

	private matrix: DOMMatrix;

	constructor(
		private ctx: CanvasContext,
		private list: SVGTransformList,
		transform: Transform | State<Transform>,
	) {
		this.svgTransform = ctx.createTransform();

		this.matrix = this.svgTransform.matrix;

		list.appendItem(this.svgTransform);

		if ("get" in transform) {
			transform.watch(this.update.bind(this));
			this.update(transform.get());
		} else this.update(transform);
	}

	public update(value: Transform) {
		const { x: a, y: b } = value.basisX;
		const { x: c, y: d } = value.basisY;
		const { x: e, y: f } = value.origin;

		Object.assign(this.matrix, { a, b, c, d, e, f });
	}

	public updateOrigin({ x, y }: Point) {
		this.matrix.e = x;
		this.matrix.f = y;
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