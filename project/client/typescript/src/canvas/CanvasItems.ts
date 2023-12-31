import { HasFill, HasStroke, HasTransform, ItemType, SpecificItem } from "../GenWrapper.js";
import { Logger } from "../Logger.js";
import { Item, LineItem, PathItem, PolygonItem } from "../gen/Types.js";
import { CanvasContext, FillHelper, StrokeHelper, TransformHelper } from "./CanvasBase.js";
import { PathHelper } from "./Path.js";

const logger = new Logger("canvas-items");

export abstract class CanvasItem {
	public abstract get element(): SVGElement;
	public abstract update(value: Item): void;

	public static create(ctx: CanvasContext, item: Item): CanvasItem {
		const builder = itemBuilders[item.type];
		if (builder != undefined) {
			// Fails type checking but should be fine
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return new builder(ctx, item as any);
		} else {
			return logger.throw(`Unimplemented item type: ${item.type}`);
		}
	}
}

abstract class ShapeItem extends CanvasItem {
	private _transform: TransformHelper;
	private _stroke: StrokeHelper;
	private _fill: FillHelper;

	private innerElem: SVGGraphicsElement;

	public get element() { return this.innerElem; }

	protected abstract createElement(ctx: CanvasContext): SVGGraphicsElement;

	public constructor(
		ctx: CanvasContext,
		protected item: Extract<Item, HasFill & HasStroke & HasTransform>,
	) {
		super();
		const elem = this.createElement(ctx);
		this.innerElem = elem;

		this._transform = new TransformHelper(ctx, elem.transform.baseVal, item.transform);
		this._stroke = new StrokeHelper(elem.style, item.stroke);
		this._fill = new FillHelper(elem.style, item.fill);
	}

	public override update(value: Item): void {
		if (!(
			"transform" in value &&
			"fill" in value &&
			"stroke" in value
		)) {
			logger.error("Recieved invalid item type for update:", value);
			return;
		}
		this.item = value;
		this._fill.update(value.fill);
		this._stroke.update(value.stroke);
		this._transform.update(value.transform);
	}
}

export class Rectangle extends ShapeItem {
	protected override createElement(ctx: CanvasContext): SVGGraphicsElement {
		const elem = ctx.createElement("rect");

		elem.setAttribute("x", "-0.5cm");
		elem.setAttribute("y", "-0.5cm");
		elem.setAttribute("width", "1cm");
		elem.setAttribute("height", "1cm");

		return elem;
	}
}

export class Ellipse extends ShapeItem {
	protected override createElement(ctx: CanvasContext): SVGGraphicsElement {
		const elem = ctx.createElement("circle");

		elem.setAttribute("r", "0.5cm");

		return elem;
	}
}

export class Line extends CanvasItem {
	private elem: SVGLineElement;

	public get element() { return this.elem; }

	private _stroke: StrokeHelper;

	public constructor(
		ctx: CanvasContext,
		private item: LineItem
	) {
		super();
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

	public override get element() { return this.elem; }

	private stroke: StrokeHelper;
	private fill: FillHelper;

	public constructor(
		ctx: CanvasContext,
		private item: PolygonItem,
	) {
		super();
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
	public override get element() { return this.elem; }

	public constructor(
		ctx: CanvasContext,
		private item: PathItem,
	) {
		const [{ position: startPoint }, ...points] = item.path.points;
		super();
		const elem = ctx.createElement("path");
		this.elem = elem;

		this.stroke = new StrokeHelper(elem.style, item.stroke);
		this.transform = new TransformHelper(ctx, elem.transform.baseVal, item.transform);

		this.pathHelper = new PathHelper(elem, startPoint);
		this.pathHelper.addNodes(...points);
	}

	public override update(value: Item): void {
		if (value.type != "Path") return logger.error(`Tried to update \`Line\` item with type \`${value.type}\`: `, value);

		this.item = value;
		this.stroke.update(value.stroke);
		this.transform.update(value.transform);
	}
}

const itemBuilders = {
	Rectangle,
	Ellipse,
	Line,
	Polygon,
	Path,
} as { [K in ItemType]?: new (_: CanvasContext, __: SpecificItem<K>) => CanvasItem };