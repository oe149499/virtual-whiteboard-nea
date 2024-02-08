import { Bounds } from "../../Bounds.js";
import { SpecificItem } from "../../GenWrapper.js";
import { Logger } from "../../Logger.js";
// import { AnyPropertyMap } from "../../Properties.js";
import { ImageItem, Item, LineItem, PathItem, Point, PolygonItem, Stroke, Transform, Transform as TransformMixin } from "../../gen/Types.js";
import { Constructor, None, Option } from "../../util/Utils.js";
import { CanvasContext, FillHelper, StrokeHelper, TransformHelper } from "../CanvasBase.js";
import { PathHelper } from "../Path.js";

const logger = new Logger("canvas-items");

export abstract class CanvasItem {
	public readonly element: SVGGElement;
	// public readonly properties?: AnyPropertyMap;
	protected abstract get innerElement(): SVGGraphicsElement;

	public abstract updateItem(value: Item): void;

	protected getBounds(): Bounds {
		return Bounds.of(this.element.getBBoxState());
	}

	#bounds: Option<Bounds> = None;

	public get bounds() {
		if (this.#bounds === None) this.#bounds = this.getBounds();
		return this.#bounds;
	}

	public testIntersection(target: Point): boolean {
		return this.bounds.testIntersection(target);
	}

	constructor(ctx: CanvasContext) {
		this.element = ctx.createElement("g");
		queueMicrotask(() => {
			this.element.appendChild(this.innerElement);
		});
	}

	protected checkType<T extends Item["type"]>(item: Item, type: T): asserts item is SpecificItem<T> {
		if (item.type !== type) logger.throw("Tried to update `%o` item with type `%o`: %o", type, item.type, item);
	}

	protected init?(ctx: CanvasContext): void;
	protected update?(): void;

	public static create(_ctx: CanvasContext, _item: Item): CanvasItem {
		throw new Error("not implemented here due to cyclic dependency");
	}
}

function TransformMixin<TBase extends Constructor<CanvasItem>>(Base: TBase) {
	abstract class Derived extends Base {
		protected abstract item: { transform: Transform };

		#transform?: TransformHelper;

		protected override init?(ctx: CanvasContext): void {
			this.#transform = new TransformHelper(ctx, this.innerElement.transform.baseVal, this.item.transform);
			super.init?.(ctx);
		}

		protected override update(): void {
			this.#transform?.update(this.item.transform);
			super.update?.();
		}
	}
	return Derived;
}

function StrokeMixin<TBase extends Constructor<CanvasItem>>(Base: TBase) {
	abstract class Derived extends Base {
		protected abstract item: { stroke: Stroke };

		#stroke?: StrokeHelper;

		protected override init?(ctx: CanvasContext): void {
			this.#stroke = new StrokeHelper(this.element.style, this.item.stroke);
			super.init?.(ctx);
		}

		protected override update(): void {
			this.#stroke?.update(this.item.stroke);
			super.update?.();
		}
	}
	return Derived;
}

export class Line extends StrokeMixin(CanvasItem) {
	private elem: SVGLineElement;

	public get innerElement() { return this.elem; }

	// private _stroke: StrokeHelper;

	public constructor(
		ctx: CanvasContext,
		protected item: LineItem,
	) {
		super(ctx);
		this.elem = ctx.createElement("line");

		this.init?.(ctx);

		// this.updateStart();
		// this.updateEnd();

		// this._stroke = new StrokeHelper(this.elem.style, item.stroke);
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Line");
		this.item = value;

		const { start, end } = value;

		this.elem.setAttrs({
			x1: start.x,
			y1: start.y,
			x2: end.x,
			y2: end.y,
		});

		// this._stroke.update(value.stroke);
		// this.updateStart();
		// this.updateEnd();
	}

	private updateStart() {
		this.elem.setAttribute("x1", this.item.start.x + "cm");
		this.elem.setAttribute("y1", this.item.start.y + "cm");
	}

	private updateEnd() {
		this.elem.setAttribute("x2", this.item.end.x + "cm");
		this.elem.setAttribute("y2", this.item.end.y + "cm");
	}
}

export class Polygon extends CanvasItem {
	private elem: SVGPolygonElement;

	public override get innerElement() { return this.elem; }

	private stroke: StrokeHelper;
	private fill: FillHelper;

	public constructor(
		ctx: CanvasContext,
		private item: PolygonItem,
	) {
		super(ctx);
		const elem = ctx.createElement("polygon");
		this.elem = elem;

		this.updatePoints();

		this.stroke = new StrokeHelper(elem.style, item.stroke);
		this.fill = new FillHelper(elem.style, item.fill);
	}

	private updatePoints() {
		let pointsStr = "";
		this.item.points.forEach(({ x, y }) => {
			pointsStr += `${x},${y} `;
		});
		this.elem.setAttribute("points", pointsStr);
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Polygon");

		this.item = value;
		this.stroke.update(value.stroke);
		this.fill.update(value.fill);
		this.updatePoints();
	}
}

export class Path extends StrokeMixin(TransformMixin(CanvasItem)) {
	private elem: SVGPathElement;
	private pathHelper: PathHelper;
	// private stroke: StrokeHelper;
	// private transform: TransformHelper;
	public override get innerElement() { return this.elem; }

	public constructor(
		ctx: CanvasContext,
		protected item: PathItem,
	) {
		const [{ position: startPoint }, ...points] = item.path.points;
		super(ctx);
		const elem = ctx.createElement("path");
		this.elem = elem;

		elem.setAttribute("fill", "none");

		// this.stroke = new StrokeHelper(elem.style, item.stroke);
		// this.transform = new TransformHelper(ctx, elem.transform.baseVal, item.transform);

		this.pathHelper = new PathHelper(elem, startPoint);
		this.pathHelper.addNodes(points);
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Path");
		this.item = value;

		// this.stroke.update(value.stroke);
		// this.transform.update(value.transform);
		this.update?.();
	}
}

export class Image extends CanvasItem {
	private elem: SVGImageElement;

	public override get innerElement() { return this.elem; }

	private transform: TransformHelper;

	public constructor(
		ctx: CanvasContext,
		item: ImageItem,
	) {
		super(ctx);

		const elem = ctx.createElement("image")
			.setAttrs({
				href: item.url,
			});
		this.elem = elem;

		this.transform = new TransformHelper(ctx, elem.transform.baseVal, item.transform);
		this.transform.createExtra().setScale(1 / 37.8, 1 / 37.8);
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Image");

		this.transform.update(value.transform);
	}
}
