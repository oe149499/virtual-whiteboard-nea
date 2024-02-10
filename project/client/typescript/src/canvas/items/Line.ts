import { SpecificItem } from "../../GenWrapper.js";
import { Item, LineItem, PathItem, PolygonItem } from "../../gen/Types.js";
import { CanvasContext } from "../CanvasBase.js";
import { PathHelper } from "../Path.js";
import { StrokeMixin, CanvasItem, FillMixin, TransformMixin } from "./CanvasItems.js";


export class Line extends StrokeMixin(CanvasItem) {
	private elem: SVGLineElement;

	public get innerElement() { return this.elem; }

	// private _stroke: StrokeHelper;
	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Line">,
	) {
		super(ctx);
		this.elem = ctx.createElement("line");

		// this.init?.(ctx);

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

export class Polygon extends FillMixin(StrokeMixin(CanvasItem)) {
	private elem: SVGPolygonElement;

	public override get innerElement() { return this.elem; }

	// private stroke: StrokeHelper;
	// private fill: FillHelper;
	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Polygon">,
	) {
		super(ctx);
		const elem = ctx.createElement("polygon");
		this.elem = elem;
	}

	private updatePoints() {
		let pointsStr = "";
		this.item.points.forEach(({ x, y }) => {
			pointsStr += `${x},${y} `;
		});
		this.elem.setAttrs({ points: pointsStr });
	}

	static {
		CanvasItem.InitHook.add(this, this.prototype.updatePoints);
		CanvasItem.UpdateHook.add(this, this.prototype.updatePoints);
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Polygon");

		this.item = value;
		//this.stroke.update(value.stroke);
		// this.fill.update(value.fill);
		// this.updatePoints();
		// this.update?.();
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
		protected item: SpecificItem<"Path">,
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

		// this.init?.(ctx);
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Path");
		this.item = value;

		// this.stroke.update(value.stroke);
		// this.transform.update(value.transform);
		// this.update?.();
	}
}
