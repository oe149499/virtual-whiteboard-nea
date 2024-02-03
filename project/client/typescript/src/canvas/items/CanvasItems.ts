import { Logger } from "../../Logger.js";
import { AnyPropertyMap } from "../../Properties.js";
import { ImageItem, Item, LineItem, PathItem, Point, PolygonItem } from "../../gen/Types.js";
import { CanvasContext, FillHelper, StrokeHelper, TransformHelper } from "../CanvasBase.js";
import { PathHelper } from "../Path.js";

const logger = new Logger("canvas-items");

export abstract class CanvasItem {
	public readonly element: SVGGElement;
	public readonly properties?: AnyPropertyMap;
	protected abstract get innerElement(): SVGGraphicsElement;

	public abstract update(value: Item): void;
	public testIntersection(target: Point): boolean {
		const bbox = this.innerElement.getBBox();
		logger.debug("elem: %o, BBox: %o, target: (%o, %o)", this.innerElement, bbox, target.x, target.y);
		return this.innerElement.getBBox().testIntersection(target);
	}

	protected constructor(ctx: CanvasContext) {
		this.element = ctx.createElement("g");
		queueMicrotask(() => {
			this.element.appendChild(this.innerElement);
		});
	}

	public static create(_ctx: CanvasContext, _item: Item): CanvasItem {
		throw new Error("not implemented here due to cyclic dependency");
	}
}

// class ItemProperties<TItem extends CanvasItem> {
// 	public constructor(
// 		private type: new (..._: never) => TItem,
// 		private loader: (item: TItem) => void,
// 		public readonly properties: AnyPropertyMap,
// 	) {
// 	}

// 	public load(item: CanvasItem) {
// 		if (item instanceof this.type) {
// 			this.loader(item);
// 		}
// 	}
// }

// export function defineProperties<TItem extends CanvasItem, TSchema extends object>(
// 	type: new (..._: never) => TItem,
// 	schema: TSchema,
// 	builder: ($: PropertyBuilder<TSchema>) => void,
// ) {
// 	const { store, props } = buildProperties(schema, builder);
// 	const itemProps = new ItemProperties(type, )
// }

export class Line extends CanvasItem {
	private elem: SVGLineElement;

	public get innerElement() { return this.elem; }

	private _stroke: StrokeHelper;

	public constructor(
		ctx: CanvasContext,
		private item: LineItem
	) {
		super(ctx);
		this.elem = ctx.createElement("line");

		this.updateStart();
		this.updateEnd();

		this._stroke = new StrokeHelper(this.elem.style, item.stroke);
	}

	public override update(value: Item): void {
		if (value.type != "Line") {
			logger.error("Expected Line item but recieved: ", value);
			return;
		}
		this.item = value;
		this._stroke.update(value.stroke);
		this.updateStart();
		this.updateEnd();
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

	public override update(value: Item): void {
		if (value.type != "Polygon") {
			logger.error(`Tried to update \`Polygon\` item with type \`${value.type}\`:`, value);
			return;
		}

		this.item = value;
		this.stroke.update(value.stroke);
		this.fill.update(value.fill);
		this.updatePoints();
	}
}

export class Path extends CanvasItem {
	private elem: SVGPathElement;
	private pathHelper: PathHelper;
	private stroke: StrokeHelper;
	private transform: TransformHelper;
	public override get innerElement() { return this.elem; }

	public constructor(
		ctx: CanvasContext,
		item: PathItem,
	) {
		const [{ position: startPoint }, ...points] = item.path.points;
		super(ctx);
		const elem = ctx.createElement("path");
		this.elem = elem;

		elem.setAttribute("fill", "none");

		this.stroke = new StrokeHelper(elem.style, item.stroke);
		this.transform = new TransformHelper(ctx, elem.transform.baseVal, item.transform);

		this.pathHelper = new PathHelper(elem, startPoint);
		this.pathHelper.addNodes(points);
	}

	public override update(value: Item): void {
		if (value.type != "Path") return logger.error(`Tried to update \`Line\` item with type \`${value.type}\`: `, value);

		this.stroke.update(value.stroke);
		this.transform.update(value.transform);
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

	public override update(value: Item): void {
		if (value.type !== "Image") return logger.error(`Tried to update \`Image\` item with type \`${value.type}\`: `, value);

		this.transform.update(value.transform);
	}
}