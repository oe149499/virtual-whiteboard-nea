import { updateMatrix } from "../Transform.js";
import { Color, Point, Stroke, Transform } from "../gen/Types.js";
import { State, mutableStateOf, type MaybeState } from "../util/State.js";
import { FilterHandle, GestureHandler, GestureLayer } from "./Gesture.js";
import { BoardTable } from "../BoardTable.js";
import { point } from "../util/Utils.js";

export const SVGNS = "http://www.w3.org/2000/svg";
export const PX_PER_CM = 37.8;

export interface CoordinateMapping {
	screenOrigin: Point;
	stretch: number;
	targetOffset: Point;
}

export type CanvasContextExecutor = (_: {
	gestures: GestureHandler,
	svg: SVGSVGElement,
}) => void;

export interface CanvasContextInit {
	cursorPos: State<Point>;
	exec?: CanvasContextExecutor;
}

export class CanvasContext {
	private svgroot = document.createElementNS(SVGNS, "svg");

	private scaledRoot = this.svgroot.createChild("g").addClasses("scaled-root");
	private unscaledRoot = this.svgroot.createChild("g").addClasses("unscaled-root");

	constructor(
		public readonly coordMapping: State<CoordinateMapping>,
		init: CanvasContextInit,
	) {
		init.exec?.({
			gestures: this.gestures,
			svg: this.svgroot,
		});

		const transform = this.createTransform();
		this.scaledRoot.transform.baseVal.appendItem(transform);
		coordMapping.watchOn(this, ({ targetOffset: o, stretch }) => {
			transform.setMatrix({
				a: stretch,
				b: 0,
				c: 0,
				d: stretch,
				e: -o.x * stretch,
				f: -o.y * stretch,
			});
		});

		this.cursorPosition = init.cursorPos.with(coordMapping).derivedT(this.translate);
	}

	public readonly cursorPosition: State<Point>;

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
		// this.points.add(point);
		if (p) {
			point.x = p.x;
			point.y = p.y;
		}
		return point;
	}

	public createPointBy = (s: State<Point>) => {
		const point = this.createPoint(s.get());
		s.watchOn(point, ({ x, y }) => {
			point.x = x;
			point.y = y;
		});
		return point;
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
		return this.scaledRoot.appendChild(this.createElement(name));
	}

	public insertScaled(element: SVGElement) {
		return this.scaledRoot.appendChild(element);
	}

	public getUnscaledHandle() {
		const handle = new CanvasContext.UnscaledHandle(this);
		CanvasContext.UnscaledHandleFinalizer.register(handle, handle["elements"]);
		return handle;
	}

	public getUnscaledPos = (pos: State<Point>) =>
		this.coordMapping
			.with(pos)
			.derivedT(({ targetOffset: o, stretch }, p) => ({
				x: (p.x - o.x) * stretch,
				y: (p.y - o.y) * stretch,
			}));


	public createUnscaledElement<N extends SVGGraphicsElementNames>(name: N, pos: State<Point>) {
		const elem = this.createElement(name);
		return this.insertUnscaled(elem, pos);
	}

	public insertUnscaled<E extends SVGGraphicsElement>(elem: E, pos: State<Point>) {
		this.unscaledRoot.appendChild(elem);
		const transform = this.createTransform();
		elem.transform.baseVal.appendItem(transform);
		this.getUnscaledPos(pos)
			.watchOn(elem, ({ x, y }) => transform.setMatrix({
				a: PX_PER_CM,
				b: 0,
				c: 0,
				d: PX_PER_CM,
				e: x,
				f: y,
			}));
		return elem;
	}

	public translate(p: Point, m?: CoordinateMapping) {
		const { screenOrigin, stretch, targetOffset } = m ?? this.coordMapping.get();
		return {
			x: ((p.x - screenOrigin.x) / stretch) + targetOffset.x,
			y: ((p.y - screenOrigin.y) / stretch) + targetOffset.y,
		};
	}

	private static UnscaledHandleFinalizer = new FinalizationRegistry<ReadonlySet<SVGElement>>(elems => {
		for (const elem of elems) elem.remove();
	});

	private static UnscaledHandle = class UnscaledHandle {
		private elements = new Set<SVGElement>();
		public constructor(public readonly ctx: CanvasContext) { }

		public insert<E extends SVGGraphicsElement>(elem: E, pos: State<Point>) {
			this.elements.add(elem);
			return this.ctx.insertUnscaled(elem, pos);
		}

		public insertStatic<E extends SVGElement>(elem: E) {
			this.elements.add(elem);
			this.ctx.unscaledRoot.appendChild(elem);
			return elem;
		}

		public create<N extends SVGGraphicsElementNames>(name: N, pos: State<Point>) {
			const elem = this.ctx.createUnscaledElement(name, pos);
			this.elements.add(elem);
			return elem;
		}

		public getPoint(pos: State<Point>) {
			return this.ctx.createPointBy(this.ctx.getUnscaledPos(pos));
		}

		public clear() {
			for (const elem of this.elements.drain()) elem.remove();
		}
	};
}

export type UnscaledHandle = InstanceType<(typeof CanvasContext)["UnscaledHandle"]>

export type SVGGraphicsElementNames = keyof {
	[K in keyof SVGElementTagNameMap as SVGElementTagNameMap[K] extends SVGGraphicsElement ? K : never]: SVGElementTagNameMap[K]
};
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
		updateMatrix(this.matrix, value);
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

	public static apply(element: SVGElement, stroke: Stroke) {
		this.prototype.update.call(element, stroke);
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

	public static apply(element: SVGElement, fill: Color) {
		this.prototype.update.call(element, fill);
	}
}

export class CenterHelper {
	static parentMap = new WeakMap<SVGGraphicsElement, SVGTransform>();

	static observer = new ResizeObserver(entries => {
		for (const entry of entries) {
			const element = entry.target;
			if (this.parentMap.has(element)) {
				const bbox = element.getBBox();
				console.log(bbox);
				const transform = this.parentMap.get(element)!;
				const cx = (bbox.left + bbox.right) / 2;
				const cy = (bbox.top + bbox.bottom) / 2;
				transform.setTranslate(-cx / PX_PER_CM, -cy / PX_PER_CM);
			}
		}
	});

	static of(target: SVGGraphicsElement) {
		const holder = document.createElementNS(SVGNS, "g");
		const transform = holder.transform.baseVal.createSVGTransformFromMatrix();

		console.log(target);

		holder.transform.baseVal.appendItem(transform);
		holder.appendChild(target);

		this.parentMap.set(holder, transform);
		this.observer.observe(holder);

		return holder;
	}
}