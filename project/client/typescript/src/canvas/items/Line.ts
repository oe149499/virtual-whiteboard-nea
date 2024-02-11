import { SpecificItem } from "../../GenWrapper.js";
import { Item } from "../../gen/Types.js";
import { CanvasContext } from "../CanvasBase.js";
import { PathHelper } from "../Path.js";
import { StrokeMixin, CanvasItem, FillMixin, TransformMixin } from "./CanvasItems.js";


export class Line extends StrokeMixin(CanvasItem) {
	private elem: SVGLineElement;

	public get innerElement() { return this.elem; }

	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Line">,
	) {
		super(ctx);
		this.elem = ctx.createElement("line");
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
