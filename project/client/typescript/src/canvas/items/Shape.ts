import { HasFill, HasStroke, HasTransform } from "../../GenWrapper.js";
import { Logger } from "../../Logger.js";
import { Item } from "../../gen/Types.js";
import { CanvasContext } from "../CanvasBase.js";
import { FillItem, TransformMixin } from "./CanvasItems.js";

const logger = new Logger("canvas/items/Shape");


abstract class ShapeItem extends TransformMixin(FillItem) {
	private innerElem: SVGGraphicsElement;

	public get innerElement() { return this.innerElem; }

	protected abstract createElement(ctx: CanvasContext): SVGGraphicsElement;

	public constructor(
		ctx: CanvasContext,
		protected item: Extract<Item, HasFill & HasStroke & HasTransform>,
	) {
		super(ctx);

		const elem = this.createElement(ctx);
		this.innerElem = elem;
	}

	public override updateItem(value: Item): void {
		if (!(
			"transform" in value &&
			"fill" in value &&
			"stroke" in value
		)) {
			logger.error("Recieved invalid item type for update:", value);
			return;
		}
		this.item = value;
	}
}

export class Rectangle extends ShapeItem {
	protected override createElement(ctx: CanvasContext): SVGGraphicsElement {
		return ctx.createElement("rect")
			.setAttrs({
				x: -0.5,
				y: -0.5,
				width: 1,
				height: 1,
			});
	}
}

export class Ellipse extends ShapeItem {
	protected override createElement(ctx: CanvasContext): SVGGraphicsElement {
		const elem = ctx.createElement("circle");

		elem.setAttribute("r", "0.5");

		return elem;
	}
}
