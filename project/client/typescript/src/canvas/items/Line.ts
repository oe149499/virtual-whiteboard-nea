import { SpecificItem } from "../../GenWrapper.js";
import type { PropertySchema } from "../../Properties.js";
import { PropertyTemplates } from "../../PropertyTemplates.js";
import { Item, type LocationUpdate } from "../../gen/Types.js";
import { CanvasContext } from "../CanvasBase.js";
import { PathHelper } from "../Path.js";
import { StrokeMixin, CanvasItem, FillMixin, TransformMixin, type ItemPropertyStore } from "./CanvasItems.js";


export class Line extends StrokeMixin(CanvasItem) {
	private elem: SVGLineElement;

	public get innerElement() { return this.elem; }

	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Line">,
	) {
		super(ctx);
		this.elem = ctx.createElement("line");
		this.updateItem(item);
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
	}

	public override getLocationUpdate(transform: DOMMatrix): LocationUpdate {
		const start = transform.transformPoint(this.item.start);
		const end = transform.transformPoint(this.item.end);
		return { Points: [start.getXY(), end.getXY()] };
	}

	public override applylocationUpdate(update: LocationUpdate): void {
		if ("Transform" in update) return;
		const { Points: [start, end] } = update;
		this.item.start = start;
		this.item.end = end;
		this.updateItem(this.item);
	}

	static {
		const conf = (prop: "start" | "end", displayName: string, store: ItemPropertyStore): PropertySchema => {
			const { keys: { x, y }, schema } = PropertyTemplates.PointSchema();

			store.getter("Line", x, item => item[prop].x);
			store.setter("Line", x, (item, val) => item[prop].x = val);
			store.getter("Line", y, item => item[prop].y);
			store.setter("Line", y, (item, val) => item[prop].y = val);

			return {
				type: "struct",
				displayName,
				fields: schema,
			};
		};

		CanvasItem.PropertiesHook.add(this, conf.bind(null, "start", "Start"));
		CanvasItem.PropertiesHook.add(this, conf.bind(null, "end", "End"));
	}
}

export class Polygon extends FillMixin(StrokeMixin(CanvasItem)) {
	private elem: SVGPolygonElement;

	public override get innerElement() { return this.elem; }

	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Polygon">,
	) {
		super(ctx);
		const elem = ctx.createElement("polygon");
		this.elem = elem;
	}

	private updatePoints() {
		const points = this.item.points.map(({ x, y }) => `${x},${y}`).join(" ");
		this.elem.setAttrs({ points });
	}

	static {
		CanvasItem.InitHook.add(this, this.prototype.updatePoints);
		CanvasItem.UpdateHook.add(this, this.prototype.updatePoints);
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Polygon");

		this.item = value;
	}

	public override getLocationUpdate(transform: DOMMatrix): LocationUpdate {
		return {
			Points: this.item.points.map(
				p => transform.transformPoint(p).getXY(),
			),
		};
	}

	public override applylocationUpdate(update: LocationUpdate): void {
		if ("Transform" in update) return;
		({ Points: this.item.points } = update);
		this.updatePoints();
	}
}

export class Path extends StrokeMixin(TransformMixin(CanvasItem)) {
	private elem: SVGPathElement;
	private pathHelper: PathHelper;
	public override get innerElement() { return this.elem; }

	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Path">,
	) {
		const [{ position: startPoint }, ...points] = item.path.points;
		super(ctx);
		const elem = ctx.createElement("path");
		this.elem = elem;

		elem.setAttribute("fill", "none");

		this.pathHelper = new PathHelper(elem, startPoint);
		this.pathHelper.addNodes(points);
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Path");
		this.item = value;
	}
}
