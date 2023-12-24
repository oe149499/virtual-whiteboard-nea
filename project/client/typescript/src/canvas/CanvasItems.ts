import { todo } from "../Utils.js";
import { Color, Item, RectangleItem, Stroke, Transform } from "../gen/Types.js";
import { CanvasContext, FillHelper, StrokeHelper, TransformHelper } from "./CanvasBase.js";

export abstract class CanvasItem {
	public abstract get element(): SVGElement;

	public static create(ctx: CanvasContext, item: Item): CanvasItem {
		switch (item.type) {
		case "Rectangle": return new Rectangle(ctx, item);
		case "Ellipse": break;
		case "Line": break;
		case "Polygon": break;
		case "Path": break;
		case "Image": break;
		case "Text": break;
		case "Link": break;
		case "Tag": break;
		}
		todo();
	}
}

abstract class ShapeItem extends CanvasItem {
	private _transform: TransformHelper;
	private _stroke: StrokeHelper;
	private _fill: FillHelper;

	private innerElem: SVGGraphicsElement;

	public get element() {return this.innerElem;}

	public get transform() {return this.item.transform;}
	public set transform(value) {
		this.item.transform = value;
		this._transform.value = value;
	}
	public get stroke() {return this.item.stroke;}
	public set stroke(value) {
		this.item.stroke = value;
		this._stroke.value = value;
	}
	public get fill() {return this.item.fill;}
	public set fill(value) {
		this.item.fill = value;
		this._fill.value = value;
	}

	protected abstract createElement(ctx: CanvasContext): SVGGraphicsElement;

	public constructor(
		ctx: CanvasContext, 
		protected item: {transform: Transform, stroke: Stroke, fill: Color}
	) {
		super();
		const elem = this.createElement(ctx);
		this.innerElem = elem;

		this._transform = new TransformHelper(ctx, elem.transform.baseVal, this.item.transform);
		this._stroke = new StrokeHelper(elem.style, item.stroke);
		this._fill = new FillHelper(elem.style, item.fill);
	}
}

export class Rectangle extends ShapeItem implements RectangleItem {
	protected override createElement(ctx: CanvasContext): SVGGraphicsElement {
		const elem = ctx.createElement("rect") as SVGRectElement;

		elem.setAttribute("x", "-0.5cm");
		elem.setAttribute("y", "-0.5cm");
		elem.setAttribute("width", "1cm");
		elem.setAttribute("height", "1cm");

		return elem;
	}
}